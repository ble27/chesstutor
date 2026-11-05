"""Typed, replayable proof attached to an independently verified badge."""

from dataclasses import dataclass
from typing import Literal

from services.core.analysis.values import EngineLine
from services.core.classification.badges import Badge

Motif = Literal["forced_mate", "material_win", "unique_move", "sacrifice"]


@dataclass(frozen=True)
class BadgeProof:
    id: str
    badge: Badge
    motif: Motif
    ply: int
    root_fen: str
    line: EngineLine
    reserved_ms: int
    offered_material_points: int = 0
    verified_followup_plies: int = 0
    expected_score_after_reply: float | None = None
    policy_version: str = "v1"
    survival_line: EngineLine | None = None
