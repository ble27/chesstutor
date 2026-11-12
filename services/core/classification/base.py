"""Versioned, mover-relative move classification policy."""

from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

from services.core.analysis.values import Color, EvidenceStatus, Wdl

BaseLabel = Literal["forced", "best", "good", "inaccuracy", "mistake", "blunder", "unclassified"]
POLICY_VERSION = "v3"
BLUNDER_MATERIAL_POINTS = 3  # a whole minor piece, the smallest "major material"


SWING_INACCURACY, SWING_MISTAKE, SWING_BLUNDER = 0.5, 1.0, 2.0  # pawns, mover's point of view
SEVERITY = ("good", "inaccuracy", "mistake", "blunder")
LOSING_PAWNS, DRAWN_PAWNS = -1.5, -0.5


@dataclass(frozen=True)
class TacticalCost:
    """What the played engine line costs the mover beyond the expected-score drop.

    `material_points` uses P=1/N=3/B=3/R=5/Q=9 relative to the engine's best line.
    Pawn figures are mover-relative engine scores (mate counted as +/-99).
    `swing_pawns=None` means no score evidence, so only the expected-score band applies.
    """

    material_points: int
    allows_mate: bool
    missed_mate: bool = False
    swing_pawns: float | None = None
    best_pawns: float | None = None
    played_pawns: float | None = None
    won_material: bool = False

    @property
    def flips_result(self) -> bool:
        """A drawn or winning position turned into a clearly losing one."""
        if self.best_pawns is None or self.played_pawns is None:
            return False
        return self.best_pawns > DRAWN_PAWNS and self.played_pawns <= LOSING_PAWNS

    @property
    def justifies_blunder(self) -> bool:
        return (
            self.allows_mate
            or self.missed_mate
            or self.flips_result
            or self.material_points >= BLUNDER_MATERIAL_POINTS
        )


def swing_label(pawns: float) -> BaseLabel:
    if pawns >= SWING_BLUNDER:
        return "blunder"
    if pawns >= SWING_MISTAKE:
        return "mistake"
    return "inaccuracy" if pawns >= SWING_INACCURACY else "good"


def least_severe(first: BaseLabel, second: BaseLabel) -> BaseLabel:
    return first if SEVERITY.index(first) <= SEVERITY.index(second) else second


def refine_label(label: BaseLabel, tactical: TacticalCost | None) -> BaseLabel:
    """Temper the expected-score label with the pawn swing and what the line really costs."""
    if tactical is None or label not in SEVERITY:
        return label
    if tactical.swing_pawns is not None:
        label = least_severe(label, swing_label(tactical.swing_pawns))
        if tactical.won_material:
            label = least_severe(label, "inaccuracy")  # same material won by another route
    if label == "blunder" and not tactical.justifies_blunder:
        label = "mistake"
    return label


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
    tactical: TacticalCost | None = None,
) -> Classification:
    """Label one move from the expected-score loss, tempered by `tactical` evidence:
    pawn-swing bands (0.5 / 1.0 / 2.0), and a Blunder only with lost material, a mate
    or a flipped result. `None` means the plain expected-score band applies."""
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
    label = refine_label(loss_label(loss, legal_move_count, verified_top_choice), tactical)
    return Classification(label, float(loss))
