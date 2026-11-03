"""Structural result contracts for the proposed, still-unimplemented public seams."""

from collections.abc import Mapping
from typing import Protocol


class ClassificationResult(Protocol):
    base_label: str
    expected_loss: float | None
    policy_version: str


class BadgeResult(Protocol):
    badges: tuple[str, ...]
    policy_version: str
    evidence_ids: tuple[str, ...]
    heuristic: bool


class PlayerSummary(Protocol):
    counts: Mapping[str, int]
    average_expected_loss: float | None


class Coverage(Protocol):
    analyzed_plies: int
    classified_plies: int
    total_plies: int


class CriticalMoment(Protocol):
    ply: int


class PracticeTheme(Protocol):
    supporting_plies: tuple[int, ...]


class SummaryResult(Protocol):
    players: Mapping[str, PlayerSummary]
    coverage: Coverage
    is_final: bool
    game_conclusions: tuple[str, ...]
    critical_moments: tuple[CriticalMoment, ...]
    practice_themes: tuple[PracticeTheme, ...]


class TemplateBlock(Protocol):
    template_id: str
    evidence_ids: tuple[str, ...]
    values: Mapping[str, object]


class CoachingResult(Protocol):
    status: str
    player_color: str
    blocks: tuple[TemplateBlock, ...]
    evidence_ids: tuple[str, ...]
    continuation_uci: tuple[str, ...]
    suggest_deep: bool
    supporting_plies: tuple[int, ...]
    scope: str
    practice_themes: tuple[PracticeTheme, ...]


class AdmissionResult(Protocol):
    allowed: bool
    reason: str | None
    retry_after_seconds: int | None
    engine_quota_cost: int
