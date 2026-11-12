"""Pawn-swing bands (policy v3): 0.5 inaccuracy, 1.0 mistake, 2.0 blunder."""

from dataclasses import replace

import pytest

from services.core.analysis.values import CentipawnScore, MateScore, Wdl
from services.core.classification.base import TacticalCost, classify_move
from services.core.classification.cost import tactical_cost
from services.core.classification.review import classify_evidence
from tests.unit.test_lessons import LOOSE_ROOK, evidence, line

BEST = Wdl(1000, 0, 0, "white")


def label(loss_wins: int, cost: TacticalCost) -> str:
    return classify_move(
        best_wdl=BEST,
        played_wdl=Wdl(1000 - loss_wins, 0, loss_wins, "white"),
        mover="white",
        legal_move_count=20,
        verified_top_choice=False,
        evidence_status="usable",
        pv_legal=True,
        search_complete=True,
        tactical=cost,
    ).base_label


def swing(pawns: float, **extra: object) -> TacticalCost:
    fields: dict[str, object] = {"material_points": 0, "allows_mate": False, **extra}
    return TacticalCost(swing_pawns=pawns, **fields)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("pawns", "expected"),
    [
        (0.46, "good"),
        (0.5, "inaccuracy"),
        (0.99, "inaccuracy"),
        (1.0, "mistake"),
        (1.99, "mistake"),
    ],
)
def test_swing_sets_the_band_when_the_expected_score_drop_is_large(pawns, expected):
    assert label(400, swing(pawns)) == expected  # a 40% expected-score drop alone proves nothing


def test_two_pawns_is_a_blunder_only_with_a_tactical_reason():
    assert label(400, swing(2.0)) == "mistake"
    assert label(400, swing(2.0, material_points=3)) == "blunder"
    assert label(400, swing(2.0, allows_mate=True)) == "blunder"
    assert label(400, swing(2.0, missed_mate=True)) == "blunder"


def test_turning_a_drawn_game_into_a_lost_one_is_a_blunder():
    flip = swing(2.4, best_pawns=0.2, played_pawns=-2.2)
    assert label(400, flip) == "blunder"
    assert label(400, swing(2.4, best_pawns=-3.0, played_pawns=-5.4)) == "mistake"


def test_a_big_swing_while_still_winning_is_damped_by_expected_score():
    assert label(20, swing(3.0)) == "good"  # both moves win; the expected score barely moves


def test_winning_the_same_material_by_another_route_is_at_most_an_inaccuracy():
    assert label(300, swing(1.5, won_material=True)) == "inaccuracy"


def line_with(score, root, ucis):
    base = line(root, ucis, Wdl(500, 0, 500, "white"))
    return replace(base, mover_score=score, score=score)


def test_tactical_cost_reads_pawn_swing_from_mover_scores():
    best = line_with(CentipawnScore(101, "white"), LOOSE_ROOK, ["d1d4"])
    played = line_with(CentipawnScore(53, "white"), LOOSE_ROOK, ["g1h1", "g4d1"])
    item = replace(evidence(LOOSE_ROOK, "g1h1", [best]), played=played)
    cost = tactical_cost(__import__("chess").Board(LOOSE_ROOK), item)
    assert cost.swing_pawns == pytest.approx(0.48)
    assert cost.best_pawns == pytest.approx(1.01) and cost.played_pawns == pytest.approx(0.53)


def test_missing_a_mate_is_recorded():
    best = line_with(MateScore(2, "white"), LOOSE_ROOK, ["d1d4"])
    played = line_with(CentipawnScore(50, "white"), LOOSE_ROOK, ["g1h1", "g4d1"])
    item = replace(evidence(LOOSE_ROOK, "g1h1", [best]), played=played)
    assert tactical_cost(__import__("chess").Board(LOOSE_ROOK), item).missed_mate


def test_a_half_pawn_slip_in_a_better_position_is_not_a_mistake():
    """Regression: row 26 of the review sheet (Bd2: +0.53 against +1.01)."""
    best = replace(
        line_with(CentipawnScore(101, "white"), LOOSE_ROOK, ["d1d4"]), wdl=Wdl(760, 0, 240, "white")
    )
    played = replace(
        line_with(CentipawnScore(53, "white"), LOOSE_ROOK, ["g1h1", "g4d1"]),
        wdl=Wdl(560, 0, 440, "white"),
    )
    item = replace(evidence(LOOSE_ROOK, "g1h1", [best]), played=played)
    assert classify_evidence(item, "deep").label == "good"
