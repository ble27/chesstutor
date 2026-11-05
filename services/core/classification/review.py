"""Derive review classifications from persisted engine evidence."""

from dataclasses import dataclass

import chess

from services.core.analysis.values import Color, EngineLine, JobState, Mode, MoveEvidence
from services.core.classification.badges import Badge
from services.core.classification.base import BaseLabel, Classification, classify_move
from services.core.classification.proofs import BadgeProof
from services.core.classification.summary import ClassificationSummary, summarize_game


@dataclass(frozen=True)
class ReviewedMove:
    ply: int
    mover: Color
    classification: Classification
    badges: tuple[Badge, ...]
    provisional: bool
    proofs: tuple[BadgeProof, ...] = ()

    @property
    def label(self) -> BaseLabel:
        return self.classification.base_label

    @property
    def expected_loss(self) -> float | None:
        return self.classification.expected_loss

    @property
    def themes(self) -> tuple[str, ...]:
        themes = {
            "forced_mate": "mate_threat",
            "material_win": "material_tactics",
            "unique_move": "calculation",
            "sacrifice": "sacrifices",
        }
        return tuple(dict.fromkeys(themes[proof.motif] for proof in self.proofs))


def legal_line(root: chess.Board, line: EngineLine) -> bool:
    board = root.copy()
    if not line.pv:
        return False
    for step in line.pv:
        try:
            move = chess.Move.from_uci(step.uci)
        except ValueError:
            return False
        if board.is_game_over() or move not in board.legal_moves or board.san(move) != step.san:
            return False
        board.push(move)
        if board.fen() != step.fen:
            return False
    return True


def classify_evidence(evidence: MoveEvidence, mode: Mode) -> ReviewedMove:
    try:
        board = chess.Board(evidence.root_fen)
        legal = board.is_valid() and bool(evidence.best)
        legal = legal and legal_line(board, evidence.best[0]) and legal_line(board, evidence.played)
        legal = legal and evidence.played.pv[0].uci == evidence.played_uci
        legal = legal and ("white" if board.turn else "black") == evidence.mover
        legal_count = board.legal_moves.count()
    except ValueError, IndexError:
        legal, legal_count = False, 1
    best = evidence.best[0] if evidence.best else None
    top = bool(best and best.pv and best.pv[0].uci == evidence.played_uci)
    result = classify_move(
        best_wdl=best.wdl if best else None,
        played_wdl=evidence.played.wdl,
        mover=evidence.mover,
        legal_move_count=max(1, legal_count),
        verified_top_choice=top,
        evidence_status=evidence.status,
        pv_legal=legal,
        search_complete=bool(best and not best.bounded and not evidence.played.bounded),
    )
    # Base evidence alone never authorizes a badge; verification attaches proof.
    return ReviewedMove(evidence.ply, evidence.mover, result, (), mode == "quick")


def summarize_evidence(
    evidence: list[MoveEvidence], mode: Mode, state: JobState, total_plies: int
) -> ClassificationSummary:
    return summarize_game(
        state=state,
        total_plies=total_plies,
        moves=tuple(classify_evidence(move, mode) for move in evidence),
    )
