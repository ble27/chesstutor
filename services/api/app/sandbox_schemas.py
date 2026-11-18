from typing import Annotated, Literal

from pydantic import Field

from services.api.app.browser_schemas import BrowserLine
from services.api.app.game_schemas import StrictModel
from services.core.analysis.values import EngineLine, VariationMove

Uci = Annotated[str, Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$", max_length=5)]


class SandboxRequest(StrictModel):
    game_version: int = Field(ge=1)
    pgn_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    root_ply: int = Field(ge=0, le=300)
    branch: list[Uci] = Field(max_length=100)
    line: BrowserLine | None = None


class SandboxResponse(StrictModel):
    trust: Literal["client_unverified"] = "client_unverified"
    fen: str
    initial_fen: str
    moves: tuple[str, ...]
    positions: tuple[VariationMove, ...]
    legal_moves: tuple[str, ...]
    result: str | None
    claimable_draw: bool
    line: EngineLine | None
