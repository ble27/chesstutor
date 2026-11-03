from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from uuid import uuid4

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException
from starlette.responses import Response

from services.adapters.game_store import PostgresGameStore
from services.adapters.pubapi import PubAPI, RedisProviderCache
from services.adapters.readiness import ReadinessProbe, ServiceReadiness
from services.api.app.game_routes import discovery_router
from services.api.app.schemas import ErrorResponse, HealthResponse
from services.api.app.settings import Settings
from services.application.discovery import Discovery
from services.core.games.discovery import DiscoveryError


def error_response(request: Request, status: int, code: str, message: str) -> JSONResponse:
    error = ErrorResponse(
        code=code,
        message=message,
        retryable=status == 503,
        request_id=request.state.request_id,
    )
    return JSONResponse(status_code=status, content=error.model_dump(exclude_none=True))


def create_app(
    settings: Settings | None = None,
    probe: ReadinessProbe | None = None,
    discovery: Discovery | None = None,
) -> FastAPI:
    config = settings if settings is not None else Settings()
    readiness = (
        probe
        if probe is not None
        else ServiceReadiness(
            config.database_url.get_secret_value(),
            config.redis_url.get_secret_value(),
            config.dependency_timeout_seconds,
        )
    )
    resources = DiscoveryResources(config) if discovery is None else None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            if resources is not None:
                await resources.close()

    app = FastAPI(
        title="Chess Tutor API",
        version="0.1.0",
        lifespan=lifespan,
        responses={status: {"model": ErrorResponse} for status in (404, 422, 500)},
    )
    service = discovery if discovery is not None else resources.discovery if resources else None
    assert service is not None
    app.include_router(discovery_router(service))
    register_discovery_errors(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def request_id(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        message = "Resource not found" if exc.status_code == 404 else "Request rejected"
        return error_response(request, exc.status_code, "http_error", message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(request, 422, "invalid_input", "Invalid request")

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        response = error_response(
            request, 500, "internal_error", "The request could not be completed"
        )
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    register_health(app, readiness)

    return app


class DiscoveryResources:
    def __init__(self, config: Settings) -> None:
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(20, connect=5),
            limits=httpx.Limits(max_connections=1),
            trust_env=False,
        )
        self.redis = Redis.from_url(
            config.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=2
        )
        self.store = PostgresGameStore(config.database_url.get_secret_value())
        self.discovery = Discovery(
            PubAPI(self.client, RedisProviderCache(self.redis), config.pubapi_user_agent),
            self.store,
        )

    async def close(self) -> None:
        await self.client.aclose()
        await self.redis.aclose()
        self.store.close()


def register_discovery_errors(app: FastAPI) -> None:
    @app.exception_handler(DiscoveryError)
    async def discovery_error(request: Request, exc: DiscoveryError) -> JSONResponse:
        error = ErrorResponse(
            code=exc.code,
            message=exc.message,
            retryable=exc.status in {429, 503},
            request_id=request.state.request_id,
            retry_after_seconds=exc.retry_after_seconds,
        )
        headers = (
            {"Retry-After": str(exc.retry_after_seconds)}
            if exc.retry_after_seconds is not None
            else {}
        )
        return JSONResponse(
            status_code=exc.status, content=error.model_dump(exclude_none=True), headers=headers
        )

    async def dependency_error(request: Request, exc: Exception) -> JSONResponse:
        return error_response(
            request, 503, "dependencies_unavailable", "Game storage is temporarily unavailable"
        )

    app.add_exception_handler(RedisError, dependency_error)
    app.add_exception_handler(SQLAlchemyError, dependency_error)


def register_health(app: FastAPI, readiness: ReadinessProbe) -> None:
    @app.get("/api/v1/health/live", response_model=HealthResponse, operation_id="liveness")
    async def live() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get(
        "/api/v1/health/ready",
        response_model=HealthResponse,
        responses={503: {"model": ErrorResponse}},
        operation_id="readiness",
    )
    async def ready(request: Request) -> HealthResponse | JSONResponse:
        if not await readiness.check():
            return error_response(request, 503, "dependencies_unavailable", "Services are starting")
        return HealthResponse(status="ready")
