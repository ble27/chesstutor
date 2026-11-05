"""Application-layer lessons and coach answers built from a stored analysis (S5)."""

from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from services.api.app.analysis_schemas import AnalysisResponse
from services.api.app.coaching_schemas import CoachRequest
from services.application.coaching import coach_response, lessons_response
from services.core.analysis.values import AnalysisError
from services.core.coaching.templates import REFUSAL
from tests.unit.test_lessons import (
    FREE_QUEEN,
    LOOSE_ROOK,
    evidence,
    line,
    loose_rook,
    missed_queen,
    reviewed,
)


def analysis(moves, state="completed", total=4) -> AnalysisResponse:
    now = datetime.now(UTC)
    done = total if state == "completed" else 1
    return AnalysisResponse(
        id=uuid4(), game_id=uuid4(), game_version=1, mode="quick", state=state,
        completed_plies=done, total_plies=total, attempts=0, created_at=now, updated_at=now,
        deadline_at=None, error_code=None, dispatch_pending=False, cached=False,
        can_cancel=False, engine={}, evidence=[item[1] for item in moves],
        classifications=[item[0] for item in moves],
    )  # fmt: skip


def request(**changes) -> CoachRequest:
    values = {"ply": 1, "player_color": "white", "level": "beginner", "intent": "explain_move"}
    return CoachRequest(**(values | changes))


def test_lessons_cover_only_notable_plies_with_text_and_arrows():
    quiet = (reviewed("good", ply=2), replace(loose_rook()[1], ply=2))
    later = (reviewed("mistake", ply=3), replace(loose_rook()[1], ply=3))
    result = lessons_response(analysis([missed_queen(), quiet, later]), "beginner")
    assert [item.kind for item in result.lessons] == ["miss", "mistake"]
    first = result.lessons[0]
    assert "queen" in first.text and first.arrows[0].kind == "played"
    assert result.complete is True and result.level == "beginner"


def test_partial_analysis_marks_lessons_as_incomplete():
    result = lessons_response(analysis([missed_queen()], state="running"), "beginner")
    assert result.complete is False and result.lessons


def test_level_changes_wording_only():
    beginner = lessons_response(analysis([loose_rook()]), "beginner").lessons[0]
    intermediate = lessons_response(analysis([loose_rook()]), "intermediate").lessons[0]
    assert beginner.text != intermediate.text and beginner.kind == intermediate.kind


def test_explain_move_is_grounded_in_the_analyzed_position():
    result = coach_response(analysis([missed_queen()]), request())
    assert result.status == "grounded" and "queen" in result.text
    assert result.blocks and all(block.template_id for block in result.blocks)


def test_better_move_returns_a_legal_arrow_and_continuation():
    result = coach_response(analysis([missed_queen()]), request(intent="better_move"))
    assert result.continuation_uci == ["c4d5"]
    assert [(a.from_square, a.to_square) for a in result.arrows] == [("c4", "d5")]


def test_unanalyzed_ply_is_rejected():
    with pytest.raises(AnalysisError) as error:
        coach_response(analysis([missed_queen()]), request(ply=3))
    assert error.value.code == "ply_not_analyzed" and error.value.status == 409


def test_unrelated_question_is_refused_with_the_fixed_message():
    result = coach_response(
        analysis([missed_queen()]), request(intent=None, question="Write a soup recipe.")
    )
    assert result.status == "refused" and result.text == REFUSAL and not result.arrows


def test_weak_evidence_is_uncertain_and_offers_deep():
    quiet = (reviewed("good"), evidence(LOOSE_ROOK, "d1d4", [line(LOOSE_ROOK, ["d1d4"])]))
    result = coach_response(analysis([quiet]), request())
    assert result.status == "uncertain" and result.suggest_deep is True


def test_game_improvement_cites_notable_plies_of_a_finished_game():
    result = coach_response(analysis([missed_queen()]), request(intent="game_improvement"))
    assert result.scope == "this_game" and result.supporting_plies == [1]
    assert "loose_pieces" in [theme.theme for theme in result.practice_themes]


def test_game_improvement_is_not_full_while_running():
    result = coach_response(
        analysis([missed_queen()], state="running"), request(intent="game_improvement")
    )
    assert result.status == "uncertain" and result.scope == "partial_game"


def test_request_needs_an_intent_or_a_bounded_question():
    for changes in ({"intent": None}, {"question": "x" * 1001}, {"intent": "write_poem"}):
        with pytest.raises(ValueError):
            request(**changes)
    assert FREE_QUEEN


def test_lesson_text_is_the_explanation_and_alternatives_are_separate():
    lesson = lessons_response(analysis([loose_rook()]), "beginner").lessons[0]
    assert "Consider moving" not in lesson.text
    assert lesson.alternatives and "Consider moving" in lesson.alternatives[0].text
