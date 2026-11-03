"""Prototype route: validates local-engine lines without trusting their scores."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, Request

from services.adapters.browser_evidence import validate_browser_batch
from services.api.app.analysis_security import AnalysisSecurity
from services.api.app.browser_schemas import BrowserBatch, BrowserEvidence
from services.api.app.settings import Settings
from services.application.discovery import Discovery
from services.core.analysis.values import AnalysisError


def browser_router(discovery: Discovery, settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    security = AnalysisSecurity(settings)

    @router.post(
        "/games/{game_id}/browser-evidence",
        response_model=BrowserEvidence,
        operation_id="validate_browser_evidence",
    )
    async def validate(game_id: UUID, body: BrowserBatch, request: Request) -> BrowserEvidence:
        security.origin(request)
        game = await asyncio.to_thread(discovery.store.latest, game_id)
        if game is None:
            raise AnalysisError("game_not_found", "Import this game before reviewing.", 404)
        try:
            evidence = await asyncio.to_thread(validate_browser_batch, game, body)
        except ValueError as error:
            raise AnalysisError(
                "invalid_evidence", "Browser variations failed validation.", 422
            ) from error
        return BrowserEvidence(evidence=evidence)

    return router
