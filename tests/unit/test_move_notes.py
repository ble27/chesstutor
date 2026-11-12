"""Selected-ply policy notes supplement, rather than invent, tactical evidence."""

from dataclasses import replace

import pytest

from services.application.coaching import lessons_response
from tests.unit.test_coaching_service import analysis
from tests.unit.test_lessons import loose_rook, reviewed


@pytest.mark.parametrize("label", ["best", "good", "inaccuracy", "forced", "unclassified"])
def test_selected_ply_has_its_actual_label_and_played_piece(label):
    item = loose_rook()[1]
    move = reviewed(label)
    if label == "unclassified":
        move = replace(move, classification=replace(move.classification, expected_loss=None))
    note = lessons_response(analysis([(move, item)], total=1), "beginner").lessons
    assert len(note) == 1 and note[0].kind == label
    assert "king" in note[0].text and "g1" in note[0].text and "h1" in note[0].text
    if label == "unclassified":
        assert "enough" in note[0].text and "Deep" in note[0].text
        assert not note[0].arrows and not note[0].alternatives
    else:
        assert label in note[0].text.lower()


def test_notes_do_not_invent_an_unanalyzed_ply_or_a_tactical_cause():
    move, item = loose_rook()
    quiet = replace(move, classification=replace(move.classification, base_label="good"))
    result = lessons_response(analysis([(quiet, item)], state="running", total=10), "beginner")
    assert [note.ply for note in result.lessons] == [1]
    assert not result.complete
    assert "fork" not in result.lessons[0].text and "pin" not in result.lessons[0].text
