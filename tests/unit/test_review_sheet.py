"""Selection, self-checks, and rendering for the 30-position human coaching review."""

from dataclasses import replace

import chess

from scripts.review_sheet import (
    SheetEntry,
    render_entry,
    render_packet,
    select_entries,
    self_check,
)
from services.core.coaching.lessons import build_lesson
from tests.unit.test_lessons import (
    FREE_QUEEN,
    LOOSE_ROOK,
    evidence,
    line,
    loose_rook,
    missed_queen,
    reviewed,
)


def lesson_entry(game: str, ply: int, kind: str, color: str) -> SheetEntry:
    label = kind if kind in ("mistake", "blunder") else "blunder"
    badges = ("great",) if kind == "great" else ()
    move = replace(reviewed(label, badges, ply=ply), mover=color)
    root = replace(loose_rook()[1], ply=ply, mover=color)
    return SheetEntry(game, move, root, build_lesson(move, root, "beginner"))


def control_entry(game: str, ply: int, label: str) -> SheetEntry:
    move = reviewed(label, ply=ply)
    root = evidence(LOOSE_ROOK, "d1d4", [line(LOOSE_ROOK, ["d1d4"])], ply)
    return SheetEntry(game, move, root, None)


def crowd() -> list[SheetEntry]:
    kinds = ["mistake", "blunder", "great"]
    lessons = [
        lesson_entry("G1", ply, kinds[ply % 3], "white" if ply % 2 else "black")
        for ply in range(1, 41)
    ]
    controls = [
        control_entry("G2", ply, "inaccuracy" if ply % 2 else "good") for ply in range(1, 21)
    ]
    return lessons + controls


def test_selection_hits_targets_and_mixes_kinds_and_colors():
    picked = select_entries(crowd(), lesson_target=30, control_target=6)
    lessons = [e for e in picked.entries if e.lesson is not None]
    controls = [e for e in picked.entries if e.lesson is None]
    assert (len(lessons), len(controls)) == (30, 6) and not picked.short
    assert {e.lesson.kind for e in lessons if e.lesson} == {"mistake", "blunder", "great"}
    assert {e.review.mover for e in lessons} == {"white", "black"}
    assert {e.review.label for e in controls} == {"inaccuracy", "good"}


def test_selection_is_deterministic_unique_and_in_game_order():
    first = select_entries(crowd(), 30, 6).entries
    second = select_entries(list(reversed(crowd())), 30, 6).entries
    keys = [(e.game, e.review.ply) for e in first]
    assert keys == [(e.game, e.review.ply) for e in second]
    assert len(set(keys)) == len(keys) and keys == sorted(keys)


def test_a_shortfall_is_reported_rather_than_padded():
    picked = select_entries(crowd()[:10], lesson_target=30, control_target=6)
    assert picked.short is True and len(picked.entries) == 10


def test_controls_are_only_routine_unannotated_plies():
    entries = [control_entry("G1", 1, "inaccuracy"), lesson_entry("G1", 2, "blunder", "white")]
    entries.append(replace(control_entry("G1", 3, "mistake"), lesson=None))
    picked = select_entries(entries, 30, 6)
    assert [e.review.ply for e in picked.entries if e.lesson is None] == [1]


def test_a_correct_lesson_passes_the_self_check():
    move, root = missed_queen()
    entry = SheetEntry("G1", move, root, build_lesson(move, root, "beginner"))
    assert self_check(entry) == ()


def test_self_check_flags_notation_and_illegal_suggestions_and_unflagged_text():
    entry = lesson_entry("G1", 1, "mistake", "white")
    assert entry.lesson is not None
    bad_alt = replace(entry.lesson.alternatives[0], uci="d1d9", description="Play Rxd4 now.")
    bad_arrow = replace(entry.lesson.arrows[0], uci="a1a8", from_square="a1", to_square="a8")
    broken = replace(entry.lesson, alternatives=(bad_alt,), arrows=(bad_arrow,))
    problems = self_check(replace(entry, lesson=broken))
    assert any("notation" in p for p in problems)
    assert sum("illegal" in p for p in problems) >= 2
    quiet = replace(entry, review=reviewed("good"))
    assert any("routine" in p for p in self_check(quiet))


def test_entry_markdown_gives_a_reviewer_everything_and_blank_verdicts():
    move, root = missed_queen()
    entry = SheetEntry("G7", move, root, build_lesson(move, root, "beginner"))
    text = render_entry(4, entry, "s5-review/04.svg")
    assert FREE_QUEEN in text and "G7" in text and "s5-review/04.svg" in text
    assert "Bxd5" in text and "Kf1" in text  # the reviewer sees notation; the learner does not
    assert "| Correct and actionable" in text and "Script checks" in text


def test_control_entry_markdown_asks_whether_silence_is_right():
    text = render_entry(9, control_entry("G2", 3, "inaccuracy"), "s5-review/09.svg")
    assert "No note shown" in text and "Silence appropriate" in text


def test_packet_states_the_gate_tally_and_any_shortfall():
    picked = select_entries(crowd()[:10], 30, 6)
    packet = render_packet(picked, engine="Stockfish 19", mode="deep", games=["1. e4"], seed=7)
    assert "at least 30" in packet and "90%" in packet and "27 of 30" in packet
    assert "SHORT" in packet and "Stockfish 19" in packet and "seed 7" in packet
    assert chess.STARTING_FEN
