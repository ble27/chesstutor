from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response

from services.adapters.readiness import ReadinessProbe, ServiceReadiness
from services.api.app.schemas import ErrorResponse, HealthResponse
from services.api.app.settings import Settings


def error_response(request: Request, status: int, code: str, message: str) -> JSONResponse:
    error = ErrorResponse(
        code=code,
        message=message,
        retryable=status == 503,
        request_id=request.state.request_id,
    )
    return JSONResponse(status_code=status, content=error.model_dump(exclude_none=True))


def create_app(settings: Settings | None = None, probe: ReadinessProbe | None = None) -> FastAPI:
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
    app = FastAPI(
        title="Chess Tutor API",
        version="0.1.0",
        responses={status: {"model": ErrorResponse} for status in (404, 422, 500)},
    )
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

    return app
