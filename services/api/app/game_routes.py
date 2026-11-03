from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Query

from services.api.app.game_schemas import ArchivesResponse, GameResponse, GamesResponse
from services.api.app.schemas import ErrorResponse
from services.application.discovery import Discovery


def discovery_router(discovery: Discovery) -> APIRouter:
    router = APIRouter(
        prefix="/api/v1",
        responses={status: {"model": ErrorResponse} for status in (404, 409, 422, 429, 502, 503)},
    )

    @router.get(
        "/players/{username}/archives",
        response_model=ArchivesResponse,
        operation_id="player_archives",
    )
    async def archives(username: str) -> ArchivesResponse:
        return await discovery.archives(username)

    @router.get(
        "/players/{username}/games", response_model=GamesResponse, operation_id="player_games"
    )
    async def games(
        username: str,
        year: Annotated[int, Query(ge=2007, le=2100)],
        month: Annotated[int, Query(ge=1, le=12)],
        cursor: Annotated[str | None, Query(max_length=200)] = None,
        color: Literal["white", "black"] | None = None,
        opponent: Annotated[str | None, Query(max_length=25)] = None,
        time_class: Literal["bullet", "blitz", "rapid", "daily"] | None = None,
    ) -> GamesResponse:
        return await discovery.games(username, year, month, cursor, color, opponent, time_class)

    @router.get("/games/{game_id}", response_model=GameResponse, operation_id="imported_game")
    async def game(game_id: UUID) -> GameResponse:
        return await discovery.game(game_id)

    return router
