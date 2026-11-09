"""Coach notes name the specific reason (what a move allows, misses, or does)."""

import re
from dataclasses import replace

import chess
import pytest

from services.core.analysis.values import MateScore, Wdl
from services.core.classification.base import Classification
from services.core.classification.proofs import BadgeProof
from services.core.classification.review import ReviewedMove
from services.core.coaching.lessons import build_lesson, render_lesson
from tests.unit.test_lessons import evidence, line

NOTATION = re.compile(r"\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8]\b|\b[a-h]x[a-h][1-8]\b|O-O")
WIN, LOSE = Wdl(900, 100, 0, "white"), Wdl(100, 100, 800, "white")


def flaw(label, root, played_line, best_uci, mover="white"):
    item = evidence(root, played_line[0], [line(root, [best_uci], WIN)])
    played = line(root, played_line, LOSE)
    item = replace(item, played=played, mover=mover)
    review = ReviewedMove(1, mover, Classification(label, 0.4), (), False)
    lesson = build_lesson(review, item, "beginner")
    assert lesson is not None
    return lesson, render_lesson(lesson)


def test_allowing_mate_says_so_and_names_the_mating_piece():
    root = "3r2k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"
    item = evidence(root, "a1a2", [line(root, ["a1b1"], WIN)])
    played = replace(line(root, ["a1a2", "d8d1"], LOSE), mover_score=MateScore(-1, "white"))
    review = ReviewedMove(1, "white", Classification("blunder", 0.9), (), False)
    lesson = build_lesson(review, replace(item, played=played), "beginner")
    assert lesson is not None
    assert lesson.blocks[0].template_id == "lesson_blunder_mate"
    text = render_lesson(lesson)
    assert "checkmate" in text and "rook" in text and "d1" in text


def test_losing_a_defended_piece_to_a_capture_names_both_pieces():
    root = "4k3/8/8/8/8/3p4/8/N2K4 w - - 0 1"
    lesson, text = flaw("mistake", root, ["a1c2", "d3c2", "d1c2"], "d1e2")
    assert lesson.blocks[0].template_id == "lesson_mistake_capture"
    assert "pawn" in text and "knight" in text and "c2" in text and "lose material" in text


def test_allowing_a_fork_names_the_forking_piece_and_both_targets():
    root = "4k3/8/8/4n3/8/8/PR6/4K3 w - - 0 1"
    lesson, text = flaw("blunder", root, ["a2a3", "e5d3", "e1f1", "d3b2"], "e1f1")
    assert lesson.blocks[0].template_id == "lesson_blunder_fork"
    assert "fork" in text and "knight" in text and "king" in text and "b2" in text


def test_giving_up_the_center_says_the_opponent_takes_it():
    root = "rnbqkbnr/pp1ppppp/8/2P5/P7/8/2PPPPPP/RNBQKBNR b KQkq - 0 3"
    lesson, text = flaw("mistake", root, ["e7e6", "d2d4"], "e7e5", mover="black")
    assert lesson.blocks[0].template_id == "lesson_mistake_center"
    assert "center" in text and "d4" in text and "pawn" in text


def test_weakening_the_king_names_the_checking_piece():
    root = "3q2k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1"
    lesson, text = flaw("mistake", root, ["g2g4", "d8d1"], "h2h3")
    assert lesson.blocks[0].template_id == "lesson_mistake_king"
    assert "king" in text and "queen" in text and "d1" in text


def test_otherwise_a_piece_reply_is_named():
    root = "r3k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    lesson, text = flaw("mistake", root, ["e1d1", "a8b8"], "e2e4")
    assert lesson.blocks[0].template_id == "lesson_mistake_reply"
    assert "rook" in text and "b8" in text


@pytest.mark.parametrize("template", ["blunder", "mistake"])
def test_flaw_notes_never_use_vague_filler(template):
    root = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    _, text = flaw(template, root, ["e1d1", "e8d7"], "e2e4")
    assert "throws away" not in text and not NOTATION.search(text)


def praised(root, played, badge="great", best=None):
    best_uci = best or played
    item = evidence(root, played, [line(root, [best_uci], WIN)])
    review = ReviewedMove(1, "white", Classification("best", 0.0), (badge,), False)  # type: ignore[arg-type]
    lesson = build_lesson(review, replace(item, played=line(root, [played], WIN)), "beginner")
    assert lesson is not None
    return render_lesson(lesson)


def test_great_move_explains_the_fork_it_makes():
    text = praised("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7")
    assert "fork" in text and "knight" in text and "king" in text and "a8" in text
    assert "lost ground" not in text and "most other moves" not in text


def test_great_move_explains_the_pin_it_creates():
    text = praised("4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1", "f1b5")
    assert "pins" in text and "knight" in text and "d7" in text and "e8" in text


def test_great_move_that_rescues_a_piece_says_which_piece():
    text = praised("6k1/8/8/8/6b1/8/8/3R2K1 w - - 0 1", "d1d4")
    assert "rescues" in text and "rook" in text and "d1" in text


def test_great_move_names_the_open_file():
    text = praised("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "a1d1")
    assert "open d-file" in text


def test_a_great_move_with_no_provable_reason_is_still_honest():
    text = praised("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", "e1d1")
    assert "Well played" in text and "lost ground" not in text


def test_brilliant_names_what_the_sacrifice_does():
    text = praised("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7", "brilliant")
    assert "gave up material on purpose" in text and "fork" in text


def missed(root, best_uci, motif="material_win"):
    best = line(root, [best_uci], WIN)
    proof = BadgeProof("p1", "miss", motif, 1, root, best, 100)  # type: ignore[arg-type]
    item = evidence(root, "e1d1" if root[-9:-7] else "e1d1", [best])
    review = ReviewedMove(1, "white", Classification("mistake", 0.4), ("miss",), False, (proof,))
    lesson = build_lesson(review, replace(item, played=line(root, ["e1e2"], LOSE)), "beginner")
    assert lesson is not None and lesson.kind == "miss"
    return render_lesson(lesson)


def test_missed_free_pawn_names_the_capture():
    text = missed("4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1", "c3d5")
    assert "missed" in text and "knight" in text and "pawn" in text and "d5" in text


def test_missed_fork_names_the_fork():
    text = missed("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7")
    assert "missed" in text and "fork" in text


def test_missed_checkmate_in_one_names_the_mating_move():
    text = missed("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a8", "forced_mate")
    assert "missed" in text and "checkmate" in text and "a8" in text
    assert chess.Board("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1").is_valid()


def test_brilliant_does_not_present_a_plain_capture_as_the_idea():
    root = "6k1/8/8/3q4/2B5/8/8/6K1 w - - 0 1"
    text = praised(root, "c4d5", "brilliant")
    assert "captures" not in text and "takes the undefended" not in text
    assert "gave up material on purpose" in text


def test_a_pawn_or_king_reply_is_not_named_as_the_cause():
    root = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"
    lesson, text = flaw("mistake", root, ["e1d1", "e8d7"], "e2e4")
    assert lesson.blocks[0].template_id == "lesson_mistake_general"
    assert "d7" not in text


def test_a_discovered_check_is_called_a_check():
    root = "4k3/p7/8/q7/8/4N3/8/4R1K1 b - - 0 1"
    lesson, text = flaw("blunder", root, ["a7a6", "e3c4", "e8d7", "c4a5"], "e8f8", mover="black")
    assert lesson.blocks[0].template_id == "lesson_blunder_discovered_check", text
    assert "discovered check" in text
