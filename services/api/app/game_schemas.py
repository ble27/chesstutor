from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Freshness(StrictModel):
    fetched_at: datetime
    stale: bool


class ArchivesResponse(Freshness):
    username: str
    months: list[str]


class Player(StrictModel):
    username: str = Field(min_length=1, max_length=100)
    rating: int | None = Field(default=None, ge=0, le=10000)
    result: str | None = Field(default=None, max_length=100)


class GameSummary(StrictModel):
    id: UUID
    source_url: str
    white: Player
    black: Player
    end_time: datetime | None
    time_class: str | None
    rules: str
    eligibility: Literal[
        "available", "unsupported_game", "unfinished_game", "invalid_data", "game_too_large"
    ]


class GamesResponse(Freshness):
    games: list[GameSummary]
    next_cursor: str | None


class PositionResponse(StrictModel):
    ply: int = Field(ge=0, le=300)
    fen: str
    san: str | None
    uci: str | None


class GameResponse(StrictModel):
    game: GameSummary
    version: int = Field(ge=1)
    pgn_hash: str
    initial_fen: str
    result: Literal["1-0", "0-1", "1/2-1/2"]
    positions: list[PositionResponse]
