"""Experimental client evidence; validation never establishes engine authenticity."""

from typing import Annotated, Literal

from pydantic import Field

from services.api.app.game_schemas import StrictModel
from services.core.analysis.values import MoveEvidence


class BrowserScore(StrictModel):
    kind: Literal["cp", "mate"]
    value: int = Field(ge=-1000000, le=1000000)


class BrowserLine(StrictModel):
    score: BrowserScore
    wdl: tuple[Annotated[int, Field(ge=0, le=1000)], ...] | None
    depth: int = Field(ge=1, le=1000)
    nodes: int = Field(ge=1, le=1000000000)
    time_ms: int = Field(ge=0, le=10000)
    pv: list[Annotated[str, Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$", max_length=5)]] = Field(
        min_length=1, max_length=64
    )
    bounded: bool


class BrowserPly(StrictModel):
    ply: int = Field(ge=1, le=300)
    best: BrowserLine
    played: BrowserLine


class BrowserBatch(StrictModel):
    game_version: int = Field(ge=1)
    pgn_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    positions: list[BrowserPly] = Field(min_length=1, max_length=8)


class BrowserEvidence(StrictModel):
    trust: Literal["client_unverified"] = "client_unverified"
    evidence: list[MoveEvidence]
