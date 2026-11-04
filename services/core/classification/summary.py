"""Coverage-aware per-player summaries of classified moves."""

from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from services.core.analysis.values import JobState


class ClassifiedMove(Protocol):
    @property
    def ply(self) -> int: ...
    @property
    def mover(self) -> str: ...
    @property
    def label(self) -> str: ...
    @property
    def expected_loss(self) -> float | None: ...
    @property
    def themes(self) -> tuple[str, ...]: ...


@dataclass(frozen=True)
class PlayerSummary:
    counts: dict[str, int]
    average_expected_loss: float | None


@dataclass(frozen=True)
class Coverage:
    analyzed_plies: int
    classified_plies: int
    total_plies: int


@dataclass(frozen=True)
class CriticalMoment:
    ply: int
    mover: str
    label: str
    expected_loss: float


@dataclass(frozen=True)
class PracticeTheme:
    name: str
    supporting_plies: tuple[int, ...]


@dataclass(frozen=True)
class ClassificationSummary:
    players: dict[str, PlayerSummary]
    coverage: Coverage
    is_final: bool
    game_conclusions: tuple[str, ...]
    critical_moments: tuple[CriticalMoment, ...]
    practice_themes: tuple[PracticeTheme, ...]


def player_summary(moves: Sequence[ClassifiedMove], color: str) -> PlayerSummary:
    selected = [move for move in moves if move.mover == color]
    losses = [move.expected_loss for move in selected if move.expected_loss is not None]
    return PlayerSummary(
        dict(Counter(move.label for move in selected)),
        sum(losses) / len(losses) if losses else None,
    )


def critical_moments(moves: Sequence[ClassifiedMove]) -> tuple[CriticalMoment, ...]:
    eligible = [move for move in moves if move.expected_loss is not None and move.expected_loss > 0]
    eligible.sort(key=lambda move: -(move.expected_loss or 0.0))
    return tuple(
        CriticalMoment(move.ply, move.mover, move.label, move.expected_loss)
        for move in eligible[:3]
        if move.expected_loss is not None
    )


def practice_themes(moves: Sequence[ClassifiedMove]) -> tuple[PracticeTheme, ...]:
    occurrences: dict[str, list[int]] = defaultdict(list)
    for move in moves:
        for theme in set(move.themes):
            occurrences[theme].append(move.ply)
    ordered = sorted(occurrences.items(), key=lambda item: (-len(item[1]), item[0]))
    return tuple(PracticeTheme(name, tuple(plies)) for name, plies in ordered[:3])


def summarize_game(
    *, state: JobState, total_plies: int, moves: Sequence[ClassifiedMove]
) -> ClassificationSummary:
    if total_plies < 0 or len(moves) > total_plies:
        raise ValueError("Invalid analysis coverage")
    if state == "completed" and len(moves) != total_plies:
        raise ValueError("Completed analysis has missing evidence")
    coverage = Coverage(
        len(moves), sum(move.label != "unclassified" for move in moves), total_plies
    )
    final = state == "completed"
    return ClassificationSummary(
        {color: player_summary(moves, color) for color in ("white", "black")},
        coverage,
        final,
        (),
        critical_moments(moves) if final else (),
        practice_themes(moves) if final else (),
    )
