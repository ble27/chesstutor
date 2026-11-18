import asyncio
from uuid import UUID

import chess
from fastapi import APIRouter, Request
from starlette.responses import JSONResponse

from services.adapters.browser_evidence import client_line
from services.api.app.analysis_security import AnalysisSecurity
from services.api.app.sandbox_schemas import SandboxRequest, SandboxResponse
from services.api.app.settings import Settings
from services.application.discovery import Discovery
from services.core.analysis.values import AnalysisError
from services.core.sandbox import sandbox_position


def sandbox_router(discovery: Discovery, settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api/v1")
    security = AnalysisSecurity(settings)

    @router.post(
        "/games/{game_id}/sandbox", response_model=SandboxResponse, operation_id="sandbox_position"
    )
    async def replay(
        game_id: UUID, body: SandboxRequest, request: Request
    ) -> SandboxResponse | JSONResponse:
        security.origin(request)
        session = security.session(request)
        if request.cookies.get("chess_session") != session.cookie:
            return security.challenge(request, session)
        game = await asyncio.to_thread(discovery.store.latest, game_id)
        if game is None:
            raise AnalysisError("game_not_found", "Import a game before free analysis.", 404)
        if body.game_version != game.version or body.pgn_hash != game.pgn_hash:
            raise AnalysisError("game_changed", "Reopen this game before free analysis.", 409)
        if body.root_ply >= len(game.positions):
            raise AnalysisError("invalid_branch", "Invalid recorded root.", 422)
        history = [p.uci for p in game.positions[1 : body.root_ply + 1] if p.uci is not None]
        try:
            position = await asyncio.to_thread(
                sandbox_position, game.initial_fen, history, body.branch
            )
            board = chess.Board(game.initial_fen)
            for uci in position.moves:
                board.push_uci(uci)
            line = await asyncio.to_thread(client_line, board, body.line) if body.line else None
        except ValueError as error:
            raise AnalysisError(
                "invalid_branch", "Move or variation is not legal at this position.", 422
            ) from error
        return SandboxResponse(
            fen=position.fen,
            initial_fen=game.initial_fen,
            moves=position.moves,
            positions=position.positions,
            legal_moves=position.legal_moves,
            result=position.result,
            claimable_draw=position.claimable_draw,
            line=line,
        )

    return router
