from dataclasses import dataclass, field
from fractions import Fraction
from typing import Literal

Color = Literal["white", "black"]
Mode = Literal["quick", "deep"]
EvidenceStatus = Literal["usable", "insufficient", "unstable"]
JobState = Literal["queued", "running", "cancel_requested", "cancelled", "completed", "failed"]
ACTIVE_STATES = ("queued", "running", "cancel_requested")


@dataclass
class AnalysisError(Exception):
    code: str
    message: str
    status: int = 409
    retry_after_seconds: int | None = None


@dataclass(frozen=True)
class Preset:
    search_seconds: float
    multipv: int
    deadline_seconds: int


PRESETS: dict[Mode, Preset] = {"quick": Preset(0.1, 2, 90), "deep": Preset(0.75, 3, 540)}


@dataclass(frozen=True)
class CentipawnScore:
    centipawns: int
    pov: Color
    kind: Literal["cp"] = field(default="cp", init=False)


@dataclass(frozen=True)
class MateScore:
    moves: int
    pov: Color
    kind: Literal["mate"] = field(default="mate", init=False)


Score = CentipawnScore | MateScore


@dataclass(frozen=True)
class Wdl:
    wins: int
    draws: int
    losses: int
    pov: Color

    def expected(self) -> Fraction:
        return Fraction(2 * self.wins + self.draws, 2 * (self.wins + self.draws + self.losses))


@dataclass(frozen=True)
class VariationMove:
    uci: str
    san: str
    fen: str


@dataclass(frozen=True)
class EngineLine:
    score: Score
    mover_score: Score
    wdl: Wdl | None
    depth: int
    nodes: int
    time_ms: int
    pv: tuple[VariationMove, ...]
    bounded: bool = False


@dataclass(frozen=True)
class MoveEvidence:
    ply: int
    before_ply: int
    root_fen: str
    mover: Color
    played_uci: str
    best: tuple[EngineLine, ...]
    played: EngineLine
    status: EvidenceStatus
    expected_loss: float | None
    claimable_draw_before: bool
    automatic_result_after: str | None
    automatic_reason_after: str | None
