"""PRD §6 badge verification policy; verified facts are policy inputs.

These cases test badge decisions, not the still-required engine/detector proof.
"""

from typing import cast

import pytest

from tests.unit.future_sprints.contracts import policy
from tests.unit.future_sprints.results import BadgeResult


def badges(**changes: object) -> BadgeResult:
    facts: dict[str, object] = {
        "evidence_ids": ("verified-line-1",),
        "base_label": "best",
        "mode": "deep",
        "expected_loss": 0.0,
        "forced": False,
        "miss_motif": None,
        "miss_line_legal": False,
        "miss_opportunity_abandoned": False,
        "candidate_losses": (0.0, 0.20, 0.30),
        "runner_up_rechecked": True,
        "runner_up_budget_matches": True,
        "offered_material_points": 0,
        "voluntary_offer": True,
        "strongest_reply_checked": True,
        "expected_score_after_reply": 0.50,
        "verified_followup_plies": 6,
        "trivial_recapture": False,
        "already_lost_piece": False,
        "supporting_line_legal": True,
        "verification_complete": True,
        "base_search_ms": 10000,
        "verification_ms": 1500,
        "deadline_remaining_ms": 1,
    }
    facts.update(changes)
    return cast(BadgeResult, policy("services.core.classification", "award_badges")(**facts))


def test_deep_unique_best_with_verified_runner_up_gets_great():
    result = badges(candidate_losses=(0.0, 0.15, 0.30))
    assert result.badges == ("great",)
    assert result.policy_version == "v3"
    assert result.evidence_ids == ("verified-line-1",)


@pytest.mark.parametrize(
    "changes",
    [
        {"mode": "quick"},
        {"base_label": "good"},
        {"base_label": "mistake"},
        {"candidate_losses": (0.0, 0.04, 0.30)},
        {"candidate_losses": (0.0, 0.1499, 0.30)},
        {"candidate_losses": (0.0,)},
        {"evidence_ids": ()},
        {"runner_up_rechecked": False},
        {"runner_up_budget_matches": False},
        {"supporting_line_legal": False},
        {"verification_complete": False},
        {"verification_ms": 1501},
        {"deadline_remaining_ms": 0},
        {"forced": True, "base_label": "forced"},
    ],
)
def test_unverified_or_ineligible_great_is_omitted(changes):
    assert "great" not in badges(**changes).badges


@pytest.mark.parametrize("base_label", ["best", "good"])
def test_verified_material_offer_is_brilliant_and_takes_precedence(base_label):
    result = badges(base_label=base_label, offered_material_points=2)
    assert result.badges == ("brilliant",)
    assert result.heuristic is True
    assert result.evidence_ids == ("verified-line-1",)


@pytest.mark.parametrize(
    "changes",
    [
        {"mode": "quick"},
        {"base_label": "inaccuracy"},
        {"expected_loss": 0.02},
        {"offered_material_points": 1},
        {"voluntary_offer": False},
        {"strongest_reply_checked": False},
        {"expected_score_after_reply": 0.4999},
        {"verified_followup_plies": 5},
        {"trivial_recapture": True},
        {"already_lost_piece": True},
        {"supporting_line_legal": False},
        {"verification_complete": False},
        {"verification_ms": 1501},
        {"deadline_remaining_ms": 0},
        {"forced": True, "base_label": "forced"},
    ],
)
def test_unsupported_sacrifice_does_not_get_brilliant(changes):
    facts = {"offered_material_points": 2, **changes}
    assert "brilliant" not in badges(**facts).badges


@pytest.mark.parametrize("motif", ["forced_mate", "material_win"])
def test_verified_abandoned_tactic_at_loss_boundary_gets_miss(motif):
    result = badges(
        base_label="mistake",
        expected_loss=0.10,
        miss_motif=motif,
        miss_line_legal=True,
        miss_opportunity_abandoned=True,
    )
    assert result.badges == ("miss",)


@pytest.mark.parametrize(
    "changes",
    [
        {"expected_loss": 0.0999},
        {"miss_motif": None},
        {"miss_line_legal": False},
        {"miss_opportunity_abandoned": False},
        {"verification_complete": False},
        {"verification_ms": 1501},
        {"deadline_remaining_ms": 0},
    ],
)
def test_swing_or_unverified_tactic_alone_never_gets_miss(changes):
    facts = {
        "base_label": "mistake",
        "expected_loss": 0.10,
        "miss_motif": "forced_mate",
        "miss_line_legal": True,
        "miss_opportunity_abandoned": True,
        **changes,
    }
    assert "miss" not in badges(**facts).badges
