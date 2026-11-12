"""Material and mate cost of a played move, read from replayable engine lines."""

import chess

from services.core.analysis.values import EngineLine, MateScore, MoveEvidence, Score
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


MATE_PAWNS = 99.0


def pawns(score: Score) -> float:
    """Mover-relative score in pawns; a mate is +/-99 so it dwarfs any evaluation."""
    if isinstance(score, MateScore):
        return MATE_PAWNS if score.moves > 0 else -MATE_PAWNS
    return score.centipawns / 100


def delivers_mate(score: Score) -> bool:
    return isinstance(score, MateScore) and score.moves > 0


def tactical_cost(root: chess.Board, evidence: MoveEvidence) -> TacticalCost:
    """Material, mate and pawn-swing cost of the played move against the engine's best line."""
    played_score = evidence.played.mover_score
    mated = isinstance(played_score, MateScore) and played_score.moves < 0
    if not evidence.best:
        return TacticalCost(0, mated)
    best_score = evidence.best[0].mover_score
    best_p, played_p = pawns(best_score), pawns(played_score)
    lost, won = 0, False
    if len(evidence.played.pv) >= 2:
        best_material = settled_material(root, evidence.best[0])
        played_material = settled_material(root, evidence.played)
        lost = max(0, best_material - played_material)
        won = lost < 1 and played_material - material(root, root.turn) >= POINTS[chess.KNIGHT]
    return TacticalCost(
        lost,
        mated,
        missed_mate=delivers_mate(best_score) and not delivers_mate(played_score),
        swing_pawns=max(0.0, best_p - played_p),
        best_pawns=best_p,
        played_pawns=played_p,
        won_material=won,
    )
