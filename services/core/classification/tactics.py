"""Conservative material and terminal motifs supported by legal continuations."""

import chess

from services.core.analysis.values import EngineLine, MateScore
from services.core.classification.proofs import Motif
from services.core.classification.review import legal_line

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


def material_gain(board: chess.Board, line: EngineLine) -> int:
    replay = board.copy()
    before = material(replay, board.turn)
    for step in line.pv:
        replay.push_uci(step.uci)
    return material(replay, board.turn) - before


def winning_motif(board: chess.Board, line: EngineLine) -> Motif | None:
    if not legal_line(board, line):
        return None
    replay = board.copy()
    forced_defenses = True
    for step in line.pv:
        if replay.turn != board.turn and (
            replay.legal_moves.count() != 1 or replay.can_claim_draw()
        ):
            forced_defenses = False
        replay.push_uci(step.uci)
    if (
        isinstance(line.mover_score, MateScore)
        and line.mover_score.moves > 0
        and replay.is_checkmate()
        and replay.turn != board.turn
    ):
        return "forced_mate"
    # A cooperative PV is not a forcing proof: every opponent reply in this
    # narrow detector must be the only legal reply. Other material tactics are
    # deliberately unsupported until an all-defenses proof is available.
    if (
        forced_defenses
        and replay.turn == board.turn
        and len(line.pv) >= 6
        and material_gain(board, line) >= 2
    ):
        return "material_win"
    return None


def free_capture(board: chess.Board, line: EngineLine) -> bool:
    """The line starts by capturing a piece that nothing defends, so it wins material outright."""
    if not legal_line(board, line):
        return False
    move = chess.Move.from_uci(line.pv[0].uci)
    target = board.piece_at(move.to_square)
    if target is None or target.piece_type == chess.KING:
        return False
    return not board.is_attacked_by(target.color, move.to_square)


def is_recapture(board: chess.Board, move: chess.Move) -> bool:
    if not board.move_stack or not board.is_capture(move):
        return False
    previous = board.copy()
    last = previous.pop()
    return last.to_square == move.to_square and previous.is_capture(last)


def offered_capture_moves(
    board: chess.Board, move: chess.Move
) -> tuple[int, tuple[chess.Move, ...]]:
    if board.legal_moves.count() == 1 or is_recapture(board, move):
        return 0, ()
    after = board.copy()
    captured = board.piece_at(move.to_square)
    captured_points = POINTS[captured.piece_type] if captured else int(board.is_en_passant(move))
    after.push(move)
    offers: list[tuple[int, chess.Move]] = []
    for reply in after.legal_moves:
        target = after.piece_at(reply.to_square)
        if target is None or target.color != board.turn or target.piece_type == chess.KING:
            continue
        original_square = move.from_square if reply.to_square == move.to_square else reply.to_square
        if board.is_attacked_by(not board.turn, original_square):
            continue  # Previously attacked pieces are conservatively treated as already lost.
        points = POINTS[target.piece_type] - captured_points
        if points >= 2:
            offers.append((points, reply))
    return (
        (min(points for points, _ in offers), tuple(reply for _, reply in offers))
        if offers
        else (0, ())
    )
