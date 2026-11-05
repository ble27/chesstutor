"""Review findings: claims must not exceed what the board and engine lines prove."""

from dataclasses import replace

import pytest

from services.core.coaching import detect_evidence
from services.core.coaching.lessons import build_lesson
from tests.unit.test_lessons import LOOSE_ROOK, WINNING, Wdl, evidence, line, reviewed

DEFENDED_BISHOPS = "4k3/3b1b2/8/8/8/5N2/8/6K1 w - - 0 1"
LOOSE_BISHOPS = "7k/3b1b2/8/8/8/5N2/8/6K1 w - - 0 1"


def forks(fen: str, line_uci: tuple[str, ...]):
    found = detect_evidence(fen=fen, ply=1, continuation_uci=line_uci)
    return [item for item in found if item.kind == "fork"]


def test_a_fork_of_equal_defended_pieces_wins_nothing_and_is_not_reported():
    assert forks(DEFENDED_BISHOPS, ("f3e5",)) == []


def test_a_fork_of_undefended_pieces_is_reported():
    assert forks(LOOSE_BISHOPS, ("f3e5",))


def test_better_move_with_a_pin_and_a_continuation_is_uncertain_not_a_crash():
    from tests.unit.future_sprints.test_s5_coaching import coach as coach_call
    from tests.unit.future_sprints.test_s5_coaching import render

    pin_fen = "4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1"
    pin = next(
        i for i in detect_evidence(fen=pin_fen, ply=1, continuation_uci=()) if i.kind == "pin"
    )
    pin = replace(pin, continuation_uci=("e1e7",))
    result = coach_call(intent="better_move", fen=pin_fen, evidence=(pin,))
    assert result.status == "uncertain"
    assert render(result)


def test_alternatives_are_anchored_on_the_true_best_line_even_if_it_is_unusable():
    unusable_best = line(LOOSE_ROOK, ["d1d8"], WINNING, bounded=True)
    weaker = line(LOOSE_ROOK, ["d1d4"], Wdl(100, 600, 300, "white"))
    root = evidence(LOOSE_ROOK, "g1h1", [unusable_best, weaker])
    lesson = build_lesson(reviewed("mistake"), root, "beginner")
    assert lesson is not None and not lesson.alternatives


@pytest.mark.parametrize("level", ["beginner", "intermediate"])
def test_alternative_wording_makes_no_claim_beyond_what_was_checked(level):
    best = line(LOOSE_ROOK, ["d1d4"])
    lesson = build_lesson(reviewed("mistake"), evidence(LOOSE_ROOK, "g1h1", [best]), level)
    assert lesson is not None and lesson.alternatives
    text = lesson.alternatives[0].description
    assert "protected" not in text and "engine" not in text
