"""Material and mate cost of a played move, read from replayable engine lines."""

import chess

from services.core.analysis.values import EngineLine, MateScore, MoveEvidence
from services.core.classification.base import TacticalCost

POINTS = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}


def material(board: chess.Board, color: chess.Color) -> int:
    return sum(
        POINTS[piece.piece_type] * (1 if piece.color == color else -1)
        for piece in board.piece_map().values()
    )


def can_recapture(board: chess.Board, square: int) -> bool:
    return any(board.is_capture(move) and move.to_square == square for move in board.legal_moves)


def settled_material(root: chess.Board, line: EngineLine) -> int:
    """Mover's material after the line, ignoring a final capture that can be recaptured."""
    moves = [chess.Move.from_uci(step.uci) for step in line.pv]
    positions = [root.copy()]
    for move in moves:
        positions.append(positions[-1].copy())
        positions[-1].push(move)
    plies = len(moves)
    while (
        plies
        and positions[plies - 1].is_capture(moves[plies - 1])
        and can_recapture(positions[plies], moves[plies - 1].to_square)
    ):
        plies -= 1
    return material(positions[plies], root.turn)


def tactical_cost(root: chess.Board, evidence: MoveEvidence) -> TacticalCost:
    """Points lost against the engine's best line, and whether the played line gets mated."""
    mated = (
        isinstance(evidence.played.mover_score, MateScore) and evidence.played.mover_score.moves < 0
    )
    if not evidence.best or len(evidence.played.pv) < 2:
        return TacticalCost(0, mated)
    best = settled_material(root, evidence.best[0])
    played = settled_material(root, evidence.played)
    return TacticalCost(max(0, best - played), mated)
