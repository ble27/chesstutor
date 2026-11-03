from uuid import UUID

from fastapi import APIRouter, Request, Response
from starlette.responses import JSONResponse

from services.api.app.analysis_schemas import AnalysisRequest, AnalysisResponse
from services.api.app.analysis_security import COOKIE, AnalysisSecurity
from services.api.app.schemas import ErrorResponse
from services.api.app.settings import Settings
from services.application.analysis import AnalysisService


def analysis_router(service: AnalysisService, settings: Settings) -> APIRouter:
    security = AnalysisSecurity(settings)
    router = APIRouter(
        prefix="/api/v1",
        responses={code: {"model": ErrorResponse} for code in (403, 404, 409, 413, 422, 429, 503)},
    )

    @router.post(
        "/analyses",
        response_model=AnalysisResponse,
        status_code=202,
        responses={200: {"model": AnalysisResponse}},
        operation_id="create_analysis",
    )
    async def create(
        body: AnalysisRequest, request: Request, response: Response
    ) -> AnalysisResponse | JSONResponse:
        security.origin(request)
        session = security.session(request)
        if request.cookies.get(COOKIE) != session.cookie:
            return security.challenge(request, session)
        result = await service.create(
            body.game_id, body.mode, session.owner, security.ip_digest(request)
        )
        response.status_code = 200 if result.cached else 202
        security.cookie(response, session)
        return result

    @router.get(
        "/analyses/{analysis_id}", response_model=AnalysisResponse, operation_id="read_analysis"
    )
    async def read(analysis_id: UUID, request: Request, response: Response) -> AnalysisResponse:
        session = security.session(request)
        result = await service.read(analysis_id, session.owner)
        security.cookie(response, session)
        return result

    @router.post(
        "/analyses/{analysis_id}/cancel",
        response_model=AnalysisResponse,
        operation_id="cancel_analysis",
    )
    async def cancel(analysis_id: UUID, request: Request, response: Response) -> AnalysisResponse:
        security.origin(request)
        session = security.session(request)
        result = await service.cancel(analysis_id, session.owner)
        security.cookie(response, session)
        return result

    return router
