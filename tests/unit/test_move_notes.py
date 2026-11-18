"""Selected-ply policy notes supplement, rather than invent, tactical evidence."""

from dataclasses import replace

import pytest

from services.application.coaching import lessons_response
from tests.unit.test_coaching_service import analysis
from tests.unit.test_lessons import loose_rook, reviewed


@pytest.mark.parametrize(
    ("label", "explanation"),
    [
        ("best", "moved from g1 to h1"),
        ("good", "moved from g1 to h1"),
        ("inaccuracy", "Try moving the rook from d1 to d4 instead"),
        ("forced", "only legal move"),
        ("unclassified", "Insufficient evidence"),
    ],
)
def test_selected_ply_has_its_actual_label_and_played_piece(label, explanation):
    item = loose_rook()[1]
    move = reviewed(label)
    if label == "unclassified":
        move = replace(move, classification=replace(move.classification, expected_loss=None))
    note = lessons_response(analysis([(move, item)], total=1), "beginner").lessons
    assert len(note) == 1 and note[0].kind == label
    assert "king" in note[0].text and "g1" in note[0].text and "h1" in note[0].text
    assert explanation in note[0].text
    assert "Stockfish" not in note[0].text and "little loss" not in note[0].text
    if label == "unclassified":
        assert not note[0].arrows and not note[0].alternatives


def test_notes_do_not_invent_an_unanalyzed_ply_or_a_tactical_cause():
    move, item = loose_rook()
    quiet = replace(move, classification=replace(move.classification, base_label="good"))
    result = lessons_response(analysis([(quiet, item)], state="running", total=10), "beginner")
    assert [note.ply for note in result.lessons] == [1]
    assert not result.complete
    assert "fork" not in result.lessons[0].text and "pin" not in result.lessons[0].text
