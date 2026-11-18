import asyncio
from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Path, Query, Request, Response

from services.adapters.coach_voice import CoachVoice
from services.api.app.analysis_schemas import AnalysisResponse
from services.api.app.analysis_security import AnalysisSecurity
from services.api.app.coaching_schemas import CoachRequest, CoachResponse, LessonsResponse
from services.api.app.schemas import ErrorResponse
from services.api.app.settings import Settings
from services.application.coaching import coach_response, lessons_response, voice_note
from services.core.coaching.values import Level


class AnalysisReader(Protocol):
    async def read(self, identifier: UUID, owner: str) -> AnalysisResponse: ...


def coaching_router(service: AnalysisReader, settings: Settings) -> APIRouter:
    security = AnalysisSecurity(settings)
    voice = CoachVoice(settings.elevenlabs_api_key.get_secret_value())
    router = APIRouter(
        prefix="/api/v1",
        responses={code: {"model": ErrorResponse} for code in (403, 404, 409, 413, 422)},
    )

    @router.get(
        "/analyses/{analysis_id}/lessons",
        response_model=LessonsResponse,
        operation_id="read_lessons",
    )
    async def lessons(
        analysis_id: UUID,
        request: Request,
        response: Response,
        level: Annotated[Level, Query()] = "beginner",
    ) -> LessonsResponse:
        session = security.session(request)
        analysis = await service.read(analysis_id, session.owner)
        security.cookie(response, session)
        return await asyncio.to_thread(lessons_response, analysis, level)

    @router.post(
        "/analyses/{analysis_id}/coach", response_model=CoachResponse, operation_id="ask_coach"
    )
    async def coach(
        analysis_id: UUID, body: CoachRequest, request: Request, response: Response
    ) -> CoachResponse:
        security.origin(request)
        session = security.session(request)
        analysis = await service.read(analysis_id, session.owner)
        security.cookie(response, session)
        return await asyncio.to_thread(coach_response, analysis, body)

    @router.post(
        "/analyses/{analysis_id}/lessons/{ply}/audio",
        response_class=Response,
        responses={
            200: {"content": {"audio/mpeg": {"schema": {"type": "string", "format": "binary"}}}},
            **{code: {"model": ErrorResponse} for code in (429, 502, 503)},
        },
        operation_id="play_coach_note",
    )
    async def audio(
        analysis_id: UUID, ply: Annotated[int, Path(ge=1, le=300)], request: Request
    ) -> Response:
        security.origin(request)
        session = security.session(request)
        analysis = await service.read(analysis_id, session.owner)
        note = await asyncio.to_thread(voice_note, analysis, ply)
        content = await voice.speak(note)
        return Response(content, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})

    return router
