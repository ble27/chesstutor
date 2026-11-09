"""PRD §6 independent policy v1; plan.md S4 numerical and evidence cases."""

from typing import cast

import pytest

from services.core.analysis.values import Wdl
from tests.unit.future_sprints.contracts import policy
from tests.unit.future_sprints.results import ClassificationResult


def classify(**changes: object) -> ClassificationResult:
    arguments: dict[str, object] = {
        "best_wdl": Wdl(8000, 0, 2000, "white"),
        "played_wdl": Wdl(8000, 0, 2000, "white"),
        "mover": "white",
        "legal_move_count": 20,
        "verified_top_choice": False,
        "evidence_status": "usable",
        "pv_legal": True,
        "search_complete": True,
        "best_score": ("cp", 200, "white"),
        "played_score": ("cp", 200, "white"),
    }
    arguments.update(changes)
    return cast(
        ClassificationResult, policy("services.core.classification", "classify_move")(**arguments)
    )


@pytest.mark.parametrize("mover", ["white", "black"])
@pytest.mark.parametrize(
    ("played_wins", "top", "label"),
    [
        (8000, True, "best"),
        (7801, True, "best"),
        (7800, True, "good"),
        (8000, False, "good"),
        (7501, False, "good"),
        (7500, False, "inaccuracy"),
        (7001, False, "inaccuracy"),
        (7000, False, "mistake"),
        (6001, False, "mistake"),
        (6000, False, "blunder"),
        (0, False, "blunder"),
    ],
)
def test_exact_loss_boundaries_for_both_colors(mover, played_wins, top, label):
    result = classify(
        mover=mover,
        best_wdl=Wdl(8000, 0, 2000, mover),
        played_wdl=Wdl(played_wins, 0, 10000 - played_wins, mover),
        verified_top_choice=top,
    )
    assert result.base_label == label
    assert result.expected_loss == pytest.approx((8000 - played_wins) / 10000)
    assert result.policy_version == "v2"


@pytest.mark.parametrize("top", [False, True])
def test_forced_takes_precedence_over_best_and_good(top):
    result = classify(legal_move_count=1, verified_top_choice=top)
    assert result.base_label == "forced"


@pytest.mark.parametrize(
    "changes",
    [
        {"best_wdl": None},
        {"played_wdl": None},
        {"evidence_status": "insufficient"},
        {"evidence_status": "unstable"},
        {"pv_legal": False},
        {"search_complete": False},
        {"legal_move_count": 1, "played_wdl": None},
    ],
)
def test_missing_or_unusable_evidence_never_gets_a_label(changes):
    result = classify(**changes)
    assert result.base_label == "unclassified"
    assert result.expected_loss is None


@pytest.mark.parametrize(("played_wins", "label"), [(8200, "good"), (8201, "unclassified")])
def test_instability_is_strictly_greater_than_two_percent(played_wins, label):
    result = classify(played_wdl=Wdl(played_wins, 0, 10000 - played_wins, "white"))
    assert result.base_label == label
    if label == "good":
        assert result.expected_loss == 0


def test_draws_count_as_half_a_win():
    result = classify(
        best_wdl=Wdl(4, 2, 4, "white"),
        played_wdl=Wdl(2, 4, 4, "white"),
    )
    assert result.expected_loss == pytest.approx(0.1)
    assert result.base_label == "mistake"


def test_white_pov_evidence_is_normalized_for_black_mover():
    result = classify(
        mover="black",
        best_wdl=Wdl(2000, 0, 8000, "white"),
        played_wdl=Wdl(4000, 0, 6000, "white"),
    )
    assert result.expected_loss == pytest.approx(0.2)
    assert result.base_label == "blunder"


@pytest.mark.parametrize(
    ("best_score", "played_score"),
    [
        (("mate", 3, "white"), ("cp", 200, "white")),
        (("mate", 3, "white"), ("mate", -2, "white")),
        (("cp", 200, "white"), ("mate", -2, "white")),
    ],
)
def test_mate_transitions_use_wdl_loss_not_mate_distance(best_score, played_score):
    result = classify(
        best_wdl=Wdl(1000, 0, 0, "white"),
        played_wdl=Wdl(0, 0, 1000, "white"),
        best_score=best_score,
        played_score=played_score,
    )
    assert result.base_label == "blunder"
    assert result.expected_loss == 1


def test_mate_without_wdl_does_not_trigger_a_centipawn_fallback():
    result = classify(best_score=("mate", 3, "white"), best_wdl=None)
    assert result.base_label == "unclassified"


@pytest.mark.parametrize("wdl", [Wdl(0, 0, 0, "white"), Wdl(-1, 0, 1001, "white")])
def test_invalid_wdl_is_rejected(wdl):
    with pytest.raises(ValueError):
        classify(best_wdl=wdl)
