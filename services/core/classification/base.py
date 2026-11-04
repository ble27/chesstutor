"""Versioned, mover-relative move classification policy."""

from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

from services.core.analysis.values import Color, EvidenceStatus, Wdl

BaseLabel = Literal["forced", "best", "good", "inaccuracy", "mistake", "blunder", "unclassified"]
POLICY_VERSION = "v1"


@dataclass(frozen=True)
class Classification:
    base_label: BaseLabel
    expected_loss: float | None
    policy_version: str = POLICY_VERSION


def expected_for_mover(wdl: Wdl, mover: Color) -> Fraction:
    if min(wdl.wins, wdl.draws, wdl.losses) < 0 or wdl.wins + wdl.draws + wdl.losses <= 0:
        raise ValueError("Invalid WDL counts")
    value = wdl.expected()
    return value if wdl.pov == mover else 1 - value


def loss_label(loss: Fraction, legal_move_count: int, verified_top_choice: bool) -> BaseLabel:
    if legal_move_count == 1:
        return "forced"
    if verified_top_choice and loss < Fraction(1, 50):
        return "best"
    if loss < Fraction(1, 20):
        return "good"
    if loss < Fraction(1, 10):
        return "inaccuracy"
    if loss < Fraction(1, 5):
        return "mistake"
    return "blunder"


def classify_move(
    *,
    best_wdl: Wdl | None,
    played_wdl: Wdl | None,
    mover: Color,
    legal_move_count: int,
    verified_top_choice: bool,
    evidence_status: EvidenceStatus,
    pv_legal: bool,
    search_complete: bool,
    best_score: tuple[str, int, str] | None = None,
    played_score: tuple[str, int, str] | None = None,
) -> Classification:
    if legal_move_count < 1:
        raise ValueError("A played move requires a legal move")
    if best_wdl is not None:
        best_expected = expected_for_mover(best_wdl, mover)
    if played_wdl is not None:
        played_expected = expected_for_mover(played_wdl, mover)
    if (
        best_wdl is None
        or played_wdl is None
        or evidence_status != "usable"
        or not pv_legal
        or not search_complete
    ):
        return Classification("unclassified", None)
    difference = best_expected - played_expected
    if difference < -Fraction(1, 50):
        return Classification("unclassified", None)
    loss = max(Fraction(0), difference)
    return Classification(loss_label(loss, legal_move_count, verified_top_choice), float(loss))
