"""Typed coaching values shared by detectors, templates, lessons, and the coach."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, Protocol

Level = Literal["beginner", "intermediate"]
Intent = Literal[
    "explain_move",
    "better_move",
    "opponent_threat",
    "position_plan",
    "explain_chess_rule",
    "game_improvement",
]
INTENTS: tuple[Intent, ...] = (
    "explain_move",
    "better_move",
    "opponent_threat",
    "position_plan",
    "explain_chess_rule",
    "game_improvement",
)
LEVELS: tuple[Level, ...] = ("beginner", "intermediate")
CoachStatus = Literal["grounded", "uncertain", "refused"]


class EvidenceRecord(Protocol):
    """Read-only shape of detector evidence; callers may supply any matching record."""

    @property
    def id(self) -> str: ...
    @property
    def kind(self) -> str: ...
    @property
    def ply(self) -> int: ...
    @property
    def fen(self) -> str: ...
    @property
    def squares(self) -> tuple[str, ...]: ...
    @property
    def continuation_uci(self) -> tuple[str, ...]: ...


@dataclass(frozen=True)
class Evidence:
    id: str
    kind: str
    ply: int
    fen: str
    squares: tuple[str, ...]
    continuation_uci: tuple[str, ...]


@dataclass(frozen=True)
class TemplateBlock:
    """A reviewed template id plus typed substitutions; never free prose."""

    template_id: str
    evidence_ids: tuple[str, ...]
    values: Mapping[str, str]


@dataclass(frozen=True)
class PracticeTheme:
    theme: str
    supporting_plies: tuple[int, ...]


@dataclass(frozen=True)
class CoachingResult:
    status: CoachStatus
    player_color: str
    blocks: tuple[TemplateBlock, ...]
    evidence_ids: tuple[str, ...] = ()
    continuation_uci: tuple[str, ...] = ()
    suggest_deep: bool = False
    supporting_plies: tuple[int, ...] = ()
    scope: str = "position"
    practice_themes: tuple[PracticeTheme, ...] = ()
