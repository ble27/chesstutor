"""PRD §7 per-ply lessons and PV arrows for notable plies (plan.md S5)."""

import re
from dataclasses import replace

import chess
import pytest

from services.core.analysis.values import (
    CentipawnScore,
    EngineLine,
    MoveEvidence,
    VariationMove,
    Wdl,
)
from services.core.classification.base import Classification
from services.core.classification.proofs import BadgeProof
from services.core.classification.review import ReviewedMove
from services.core.coaching.lessons import build_lesson, build_lessons, render_lesson

FREE_QUEEN = "6k1/8/8/3q4/2B5/8/8/6K1 w - - 0 1"
LOOSE_ROOK = "6k1/8/8/8/6b1/8/8/3R2K1 w - - 0 1"
NOTATION = re.compile(r"\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8]\b|\b[a-h]x[a-h][1-8]\b|O-O")
WINNING = Wdl(900, 100, 0, "white")
EQUAL = Wdl(100, 800, 100, "white")


def line(root: str, ucis: list[str], wdl: Wdl | None = WINNING, bounded: bool = False):
    board, steps = chess.Board(root), []
    for uci in ucis:
        move = chess.Move.from_uci(uci)
        san = board.san(move)
        board.push(move)
        steps.append(VariationMove(uci, san, board.fen()))
    score = CentipawnScore(0, "white")
    return EngineLine(score, score, wdl, 12, 1000, 100, tuple(steps), bounded)


def evidence(root: str, played: str, best: list[EngineLine], ply: int = 1) -> MoveEvidence:
    return MoveEvidence(
        ply, ply - 1, root, "white", played, tuple(best), line(root, [played], EQUAL),
        "usable", 0.3, False, None, None,
    )  # fmt: skip


def reviewed(label: str, badges: tuple[str, ...] = (), proofs=(), ply: int = 1) -> ReviewedMove:
    return ReviewedMove(ply, "white", Classification(label, 0.3), badges, False, proofs)  # type: ignore[arg-type]


def material_proof(root: str, best_line: EngineLine) -> BadgeProof:
    return BadgeProof("proof-1", "miss", "material_win", 1, root, best_line, 100)


def missed_queen():
    best = line(FREE_QUEEN, ["c4d5"])
    proof = material_proof(FREE_QUEEN, best)
    return reviewed("blunder", ("miss",), (proof,)), evidence(FREE_QUEEN, "g1f1", [best])


def loose_rook(extra: list[EngineLine] | None = None):
    best = [line(LOOSE_ROOK, ["d1d4"]), *(extra or [])]
    return reviewed("mistake"), evidence(LOOSE_ROOK, "g1h1", best)


def test_miss_names_the_missed_capture_in_plain_words():
    lesson = build_lesson(*missed_queen(), level="beginner")
    assert lesson is not None and lesson.kind == "miss"
    text = render_lesson(lesson)
    assert "missed" in text and "bishop" in text and "queen" in text and "d5" in text
    assert not NOTATION.search(text) and "Bxd5" not in text and "Kf1" not in text


def test_mistake_explains_the_piece_it_leaves_undefended():
    lesson = build_lesson(*loose_rook(), level="beginner")
    assert lesson is not None and lesson.kind == "mistake"
    text = render_lesson(lesson)
    assert "mistake" in text and "rook" in text and "d1" in text and "bishop" in text
    assert not NOTATION.search(text)


def test_lessons_cite_only_evidence_they_were_given():
    lesson = build_lesson(*loose_rook(), level="beginner")
    assert lesson is not None
    cited = {item for block in lesson.blocks for item in block.evidence_ids}
    assert cited and all(item.startswith("hanging_piece-") for item in cited)


def test_a_blunder_without_a_verified_cause_stays_general():
    move = reviewed("blunder")
    root = evidence(LOOSE_ROOK, "d1d2", [line(LOOSE_ROOK, ["d1d4"])])
    lesson = build_lesson(move, root, level="beginner")
    assert lesson is not None and lesson.kind == "blunder"
    assert [item.template_id for item in lesson.blocks] == ["lesson_blunder_general"]


@pytest.mark.parametrize("label", ["best", "good", "inaccuracy", "forced", "unclassified"])
def test_routine_plies_are_not_annotated(label):
    root = evidence(LOOSE_ROOK, "g1h1", [line(LOOSE_ROOK, ["d1d4"])])
    assert build_lesson(reviewed(label), root, level="beginner") is None


@pytest.mark.parametrize("badge", ["great", "brilliant"])
def test_notable_good_play_is_praised_without_alternatives(badge):
    best = line(LOOSE_ROOK, ["d1d4"])
    root = evidence(LOOSE_ROOK, "d1d4", [best])
    lesson = build_lesson(reviewed("best", (badge,)), root, level="beginner")
    assert lesson is not None and lesson.kind == badge
    assert [arrow.kind for arrow in lesson.arrows] == ["played"]
    assert not lesson.alternatives


def test_arrows_mark_the_played_move_and_the_engine_suggestion():
    lesson = build_lesson(*loose_rook(), level="beginner")
    assert lesson is not None
    played, suggested = lesson.arrows
    assert (played.kind, played.from_square, played.to_square) == ("played", "g1", "h1")
    assert (suggested.kind, suggested.rank) == ("suggested", 1)
    assert (suggested.from_square, suggested.to_square) == ("d1", "d4")


def test_at_most_two_alternatives_and_only_close_ones():
    close = line(LOOSE_ROOK, ["d1d8"], Wdl(880, 120, 0, "white"))
    far = line(LOOSE_ROOK, ["d1a1"], Wdl(100, 300, 600, "white"))
    lesson = build_lesson(*loose_rook([close, far]), level="beginner")
    assert lesson is not None
    assert [a.uci for a in lesson.alternatives] == ["d1d4", "d1d8"]
    assert len([a for a in lesson.arrows if a.kind == "suggested"]) == 2


def test_the_text_equivalent_of_arrows_has_no_notation():
    lesson = build_lesson(*loose_rook(), level="beginner")
    assert lesson is not None
    assert lesson.alternatives and all(a.description for a in lesson.alternatives)
    assert not any(NOTATION.search(a.description) for a in lesson.alternatives)
    assert "d4" in lesson.alternatives[0].description


def broken_lines() -> dict[str, EngineLine]:
    good = line(LOOSE_ROOK, ["d1d4"])
    illegal_step = VariationMove("d1d9", "Rd9", good.pv[0].fen)
    return {
        "bounded": replace(good, bounded=True),
        "illegal": replace(good, pv=(illegal_step,)),
        "wrong_san": replace(good, pv=(replace(good.pv[0], san="Qd4"),)),
    }


@pytest.mark.parametrize("flaw", ["bounded", "illegal", "wrong_san"])
def test_unverified_engine_lines_never_become_arrows(flaw):
    root = evidence(LOOSE_ROOK, "g1h1", [broken_lines()[flaw]])
    lesson = build_lesson(reviewed("mistake"), root, level="beginner")
    assert lesson is not None
    assert [arrow.kind for arrow in lesson.arrows] == ["played"]
    assert not lesson.alternatives


def test_the_played_move_is_never_suggested_back():
    best = line(LOOSE_ROOK, ["g1h1"])
    lesson = build_lesson(reviewed("mistake"), evidence(LOOSE_ROOK, "g1h1", [best]), "beginner")
    assert lesson is not None and not lesson.alternatives


def test_intermediate_wording_differs_without_changing_the_claim():
    beginner = build_lesson(*loose_rook(), level="beginner")
    intermediate = build_lesson(*loose_rook(), level="intermediate")
    assert beginner and intermediate
    assert render_lesson(beginner) != render_lesson(intermediate)
    assert [a.uci for a in beginner.alternatives] == [a.uci for a in intermediate.alternatives]


def test_a_game_gets_lessons_only_for_notable_plies():
    pairs = [
        (reviewed("best", ply=1), evidence(LOOSE_ROOK, "d1d4", [line(LOOSE_ROOK, ["d1d4"])], 1)),
        (reviewed("mistake", ply=2), replace(loose_rook()[1], ply=2)),
        (reviewed("good", ply=3), replace(loose_rook()[1], ply=3)),
        (reviewed("blunder", ply=4), replace(loose_rook()[1], ply=4)),
    ]
    lessons = build_lessons(pairs, level="beginner")
    assert [lesson.ply for lesson in lessons] == [2, 4]
