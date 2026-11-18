"""Versioned independent logistic accuracy; never used to classify moves."""

from collections.abc import Sequence
from dataclasses import dataclass
from math import exp
from statistics import pstdev
from typing import Literal

from services.core.analysis.values import Color, JobState, MoveEvidence, Score


@dataclass(frozen=True)
class AccuracyPlayer:
    accuracy: float | None
    scored_plies: int
    total_plies: int


@dataclass(frozen=True)
class AccuracyMove:
    ply: int
    mover: Color
    accuracy: float


@dataclass(frozen=True)
class AccuracySummary:
    version: Literal["logistic-v1"]
    players: dict[str, AccuracyPlayer]
    moves: tuple[AccuracyMove, ...]
    complete: bool


def win_percent(score: Score, mover: Color, result: str | None = None) -> float | None:
    direction = 1 if score.pov == mover else -1
    if score.kind == "mate":
        if score.moves:
            return 100.0 if score.moves * direction > 0 else 0.0
        if result in ("1-0", "0-1"):
            return 100.0 if (result == "1-0") == (mover == "white") else 0.0
        return None
    exponent = max(-700.0, min(700.0, -0.00368208 * score.centipawns * direction))
    return 100.0 / (1.0 + exp(exponent))


def move_accuracy(best: float, played: float) -> float:
    return max(0.0, min(100.0, 103.1668 * exp(-0.04354 * max(0.0, best - played)) - 3.1669))


def blend(values: Sequence[tuple[float, float]]) -> float | None:
    if not values:
        return None
    harmonic = (
        0.0 if any(a == 0 for a, _ in values) else len(values) / sum(1 / a for a, _ in values)
    )
    weighted = sum(a * w for a, w in values) / sum(w for _, w in values)
    return (harmonic + weighted) / 2


def accuracy_summary(
    evidence: Sequence[MoveEvidence],
    total_plies: int,
    state: JobState,
    start_color: Color = "white",
) -> AccuracySummary:
    window = max(2, min(8, total_plies // 10))
    history: list[float] = []
    values: dict[Color, list[tuple[float, float]]] = {"white": [], "black": []}
    moves: list[AccuracyMove] = []
    previous_ply = 0
    for item in evidence:
        if item.ply != previous_ply + 1:
            history.clear()
        previous_ply = item.ply
        best = item.best[0] if item.best else None
        if best is None or best.bounded or item.played.bounded or item.status != "usable":
            history.clear()
            continue
        before = win_percent(best.score, item.mover)
        after = win_percent(item.played.score, item.mover, item.automatic_result_after)
        if before is None or after is None:
            history.clear()
            continue
        if not history:
            history.append(before if item.mover == "white" else 100 - before)
        history.append(after if item.mover == "white" else 100 - after)
        history = history[-window:]
        weight = max(0.5, min(12.0, pstdev(history)))
        accuracy = move_accuracy(before, after)
        values[item.mover].append((accuracy, weight))
        moves.append(AccuracyMove(item.ply, item.mover, accuracy))
    first = (total_plies + 1) // 2
    totals = {start_color: first, "black" if start_color == "white" else "white": total_plies // 2}
    players: dict[str, AccuracyPlayer] = {
        c: AccuracyPlayer(blend(v), len(v), totals[c]) for c, v in values.items()
    }
    return AccuracySummary(
        "logistic-v1", players, tuple(moves), state == "completed" and len(moves) == total_plies
    )
