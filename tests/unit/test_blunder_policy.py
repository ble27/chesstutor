"""Blunder means material or mate, not just a large evaluation drop (policy v2)."""

from dataclasses import replace

import chess
import pytest

from services.core.analysis.values import CentipawnScore, MateScore, Wdl
from services.core.classification.base import TacticalCost, classify_move
from services.core.classification.review import classify_evidence
from tests.unit.test_lessons import LOOSE_ROOK, evidence, line

ROW_FOUR = "rnbqkbnr/pp1ppppp/8/2P5/P7/8/2PPPPPP/RNBQKBNR b KQkq - 0 3"
BEST, WORSE = Wdl(1000, 0, 0, "white"), Wdl(300, 0, 700, "white")


def scored(item, pawns: float, pov: str = "white"):
    """The same line with a mover-relative engine score of `pawns`."""
    score = CentipawnScore(round(pawns * 100), pov)
    return replace(item, mover_score=score, score=score)


def classify(tactical: TacticalCost | None) -> str:
    return classify_move(
        best_wdl=BEST,
        played_wdl=WORSE,
        mover="white",
        legal_move_count=20,
        verified_top_choice=False,
        evidence_status="usable",
        pv_legal=True,
        search_complete=True,
        tactical=tactical,
    ).base_label


@pytest.mark.parametrize(
    ("cost", "label"),
    [
        (TacticalCost(3, False), "blunder"),  # a whole minor piece
        (TacticalCost(9, False), "blunder"),
        (TacticalCost(0, True), "blunder"),  # allows a forced mate
        (TacticalCost(2, False), "mistake"),  # a big drop without a piece lost
        (TacticalCost(0, False), "mistake"),
    ],
)
def test_a_large_drop_is_a_blunder_only_with_material_or_mate(cost, label):
    assert classify(cost) == label


def test_other_labels_do_not_depend_on_tactical_cost():
    for cost in (TacticalCost(0, False), TacticalCost(9, True)):
        assert (
            classify_move(
                best_wdl=BEST,
                played_wdl=Wdl(970, 0, 30, "white"),
                mover="white",
                legal_move_count=20,
                verified_top_choice=False,
                evidence_status="usable",
                pv_legal=True,
                search_complete=True,
                tactical=cost,
            ).base_label
            == "good"
        )


def test_hanging_a_rook_in_the_engine_line_is_a_blunder():
    best = scored(line(LOOSE_ROOK, ["d1d4"], Wdl(900, 100, 0, "white")), 1.0)
    item = evidence(LOOSE_ROOK, "g1h1", [best])
    played = scored(line(LOOSE_ROOK, ["g1h1", "g4d1"], Wdl(0, 100, 900, "white")), -4.5)
    assert classify_evidence(replace(item, played=played), "deep").label == "blunder"


def test_mate_against_the_mover_is_a_blunder_even_with_no_material_lost():
    best = scored(line(LOOSE_ROOK, ["d1d4"], Wdl(900, 100, 0, "white")), 1.0)
    played = line(LOOSE_ROOK, ["g1h1", "g4d1"], Wdl(0, 100, 900, "white"))
    mated = replace(played, mover_score=MateScore(-1, "white"))
    review = classify_evidence(replace(evidence(LOOSE_ROOK, "g1h1", [best]), played=mated), "deep")
    assert review.label == "blunder"


def test_a_large_swing_without_material_or_mate_is_a_mistake():
    best = scored(line(ROW_FOUR, ["e7e5"], Wdl(0, 900, 100, "black")), -0.5, "black")
    played = scored(line(ROW_FOUR, ["e7e6", "d2d4"], Wdl(0, 300, 700, "black")), -3.0, "black")
    item = replace(evidence(ROW_FOUR, "e7e6", [best]), mover="black", played=played)
    assert classify_evidence(item, "deep").label == "mistake"


def test_missing_only_a_pawn_is_not_a_blunder():
    root = "4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1"
    best = scored(line(root, ["c3d5"], Wdl(900, 100, 0, "white")), 3.0)
    played = scored(line(root, ["e1e2", "d5d4"], Wdl(200, 100, 700, "white")), 0.5)
    assert (
        classify_evidence(replace(evidence(root, "e1e2", [best]), played=played), "deep").label
        == "mistake"
    )
    assert chess.Board(root).is_valid()
