"""PRD §6 summaries and §8 completed-only final conclusions; plan.md S4."""

from typing import NamedTuple, cast

import pytest

from tests.unit.future_sprints.contracts import policy
from tests.unit.future_sprints.results import SummaryResult


class ClassifiedMove(NamedTuple):
    ply: int
    mover: str
    label: str
    expected_loss: float | None
    themes: tuple[str, ...] = ()


MOVES = (
    ClassifiedMove(1, "white", "good", 0.04, ("development",)),
    ClassifiedMove(2, "black", "blunder", 0.40, ("hanging_piece",)),
    ClassifiedMove(3, "white", "unclassified", None),
    ClassifiedMove(4, "black", "mistake", 0.10, ("fork",)),
)


def summary(**changes: object) -> SummaryResult:
    inputs: dict[str, object] = {"state": "completed", "total_plies": 4, "moves": MOVES}
    inputs.update(changes)
    return cast(SummaryResult, policy("services.core.classification", "summarize_game")(**inputs))


def test_counts_and_loss_averages_are_separate_for_each_player():
    result = summary()
    assert result.players["white"].counts == {"good": 1, "unclassified": 1}
    assert result.players["black"].counts == {"blunder": 1, "mistake": 1}
    assert result.players["white"].average_expected_loss == pytest.approx(0.04)
    assert result.players["black"].average_expected_loss == pytest.approx(0.25)
    assert result.coverage.classified_plies == 3
    assert result.coverage.total_plies == 4
    assert result.is_final is True


@pytest.mark.parametrize("state", ["queued", "running", "cancel_requested", "cancelled", "failed"])
def test_incomplete_jobs_never_receive_final_conclusions(state):
    result = summary(state=state, moves=MOVES[:2])
    assert result.is_final is False
    assert result.game_conclusions == ()
    assert result.coverage.analyzed_plies == 2
    assert result.coverage.total_plies == 4


def test_zero_classified_moves_have_unknown_average_not_zero():
    result = summary(moves=(ClassifiedMove(1, "white", "unclassified", None),), total_plies=1)
    assert result.players["white"].average_expected_loss is None
    assert result.players["black"].average_expected_loss is None
    assert result.coverage.classified_plies == 0


def test_critical_moments_and_practice_themes_are_bounded_and_supported():
    moves = tuple(
        ClassifiedMove(ply, "white" if ply % 2 else "black", "blunder", loss, (theme,))
        for ply, loss, theme in [
            (1, 0.20, "fork"),
            (2, 0.50, "pin"),
            (3, 0.30, "development"),
            (4, 0.80, "mate_threat"),
            (5, 0.40, "hanging_piece"),
        ]
    )
    result = summary(moves=moves, total_plies=5)
    assert len(result.critical_moments) <= 3
    assert {moment.ply for moment in result.critical_moments} == {2, 4, 5}
    assert 0 < len(result.practice_themes) <= 3
    for theme in result.practice_themes:
        assert theme.supporting_plies
        assert set(theme.supporting_plies) <= {move.ply for move in moves}


def test_completed_state_cannot_hide_missing_plies():
    with pytest.raises(ValueError):
        summary(moves=MOVES[:2])
