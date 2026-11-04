"""Badge policy for facts already established by bounded verification."""

from dataclasses import dataclass
from typing import Literal

from services.core.analysis.values import Mode
from services.core.classification.base import POLICY_VERSION, BaseLabel

Badge = Literal["miss", "great", "brilliant"]


@dataclass(frozen=True)
class BadgeResult:
    badges: tuple[Badge, ...]
    evidence_ids: tuple[str, ...]
    heuristic: bool
    policy_version: str = POLICY_VERSION


@dataclass(frozen=True)
class BadgeEvidence:
    evidence_ids: tuple[str, ...]
    base_label: BaseLabel
    mode: Mode
    expected_loss: float
    forced: bool
    miss_motif: str | None
    miss_line_legal: bool
    miss_opportunity_abandoned: bool
    candidate_losses: tuple[float, ...]
    runner_up_rechecked: bool
    runner_up_budget_matches: bool
    offered_material_points: int
    voluntary_offer: bool
    strongest_reply_checked: bool
    expected_score_after_reply: float
    verified_followup_plies: int
    trivial_recapture: bool
    already_lost_piece: bool
    supporting_line_legal: bool
    verification_complete: bool
    base_search_ms: int
    verification_ms: int
    deadline_remaining_ms: int


def brilliant(evidence: BadgeEvidence) -> bool:
    return (
        evidence.base_label in ("best", "good")
        and evidence.expected_loss < 0.02
        and evidence.offered_material_points >= 2
        and evidence.voluntary_offer
        and evidence.strongest_reply_checked
        and evidence.expected_score_after_reply >= 0.5
        and evidence.verified_followup_plies >= 6
        and not evidence.trivial_recapture
        and not evidence.already_lost_piece
    )


def great(evidence: BadgeEvidence) -> bool:
    return (
        evidence.base_label == "best"
        and len(evidence.candidate_losses) >= 2
        and sum(loss < 0.05 for loss in evidence.candidate_losses) == 1
        and sorted(evidence.candidate_losses)[1] >= 0.15
        and evidence.runner_up_rechecked
        and evidence.runner_up_budget_matches
    )


def decide_badges(evidence: BadgeEvidence) -> BadgeResult:
    if (
        not evidence.evidence_ids
        or not evidence.verification_complete
        or evidence.deadline_remaining_ms <= 0
        or evidence.base_search_ms < 0
        or evidence.verification_ms < 0
        or evidence.verification_ms * 100 > evidence.base_search_ms * 15
    ):
        return BadgeResult((), (), False)
    missed = (
        evidence.expected_loss >= 0.10
        and evidence.miss_motif in ("forced_mate", "material_win")
        and evidence.miss_line_legal
        and evidence.miss_opportunity_abandoned
    )
    if missed:
        return BadgeResult(("miss",), evidence.evidence_ids, False)
    if evidence.mode != "deep" or evidence.forced or not evidence.supporting_line_legal:
        return BadgeResult((), (), False)
    if brilliant(evidence):
        return BadgeResult(("brilliant",), evidence.evidence_ids, True)
    if great(evidence):
        return BadgeResult(("great",), evidence.evidence_ids, False)
    return BadgeResult((), (), False)


def award_badges(
    *,
    evidence_ids: tuple[str, ...],
    base_label: BaseLabel,
    mode: Mode,
    expected_loss: float,
    forced: bool,
    miss_motif: str | None,
    miss_line_legal: bool,
    miss_opportunity_abandoned: bool,
    candidate_losses: tuple[float, ...],
    runner_up_rechecked: bool,
    runner_up_budget_matches: bool,
    offered_material_points: int,
    voluntary_offer: bool,
    strongest_reply_checked: bool,
    expected_score_after_reply: float,
    verified_followup_plies: int,
    trivial_recapture: bool,
    already_lost_piece: bool,
    supporting_line_legal: bool,
    verification_complete: bool,
    base_search_ms: int,
    verification_ms: int,
    deadline_remaining_ms: int,
) -> BadgeResult:
    return decide_badges(
        BadgeEvidence(
            evidence_ids,
            base_label,
            mode,
            expected_loss,
            forced,
            miss_motif,
            miss_line_legal,
            miss_opportunity_abandoned,
            candidate_losses,
            runner_up_rechecked,
            runner_up_budget_matches,
            offered_material_points,
            voluntary_offer,
            strongest_reply_checked,
            expected_score_after_reply,
            verified_followup_plies,
            trivial_recapture,
            already_lost_piece,
            supporting_line_legal,
            verification_complete,
            base_search_ms,
            verification_ms,
            deadline_remaining_ms,
        )
    )
