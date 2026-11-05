"""Conservative, position-bound tactical detectors: hanging piece, fork, and pin.

Each detector states only what the board proves. A "hanging piece" is attacked
and has no defender; a fork needs a safe forking piece; a pin is absolute.
Other themes are reported as unsupported by `templates.template_for_evidence`.
"""

from collections.abc import Iterator

import chess

from services.core.coaching.values import Evidence

POINTS = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}
MAX_PER_KIND = 3


def square_names(*squares: int) -> tuple[str, ...]:
    return tuple(chess.square_name(square) for square in squares)


def hanging_captures(board: chess.Board) -> Iterator[chess.Move]:
    """Legal captures by the side to move of undefended, non-king pieces."""
    for move in board.legal_moves:
        target = board.piece_at(move.to_square)
        if target is None or target.piece_type == chess.KING:
            continue
        if not board.is_attacked_by(target.color, move.to_square):
            yield move


def capture_evidence(fen: str, ply: int, move: chess.Move) -> Evidence:
    squares = square_names(move.from_square, move.to_square)
    return Evidence(
        evidence_id("hanging_piece", ply, squares),
        "hanging_piece",
        ply,
        fen,
        squares,
        (move.uci(),),
    )


def hanging_evidence(board: chess.Board, fen: str, ply: int) -> list[Evidence]:
    def value(move: chess.Move) -> int:
        target = board.piece_at(move.to_square)
        return POINTS[target.piece_type] if target else 0

    ranked = sorted(hanging_captures(board), key=value, reverse=True)
    return [capture_evidence(fen, ply, move) for move in ranked[:MAX_PER_KIND]]


def fork_targets(board: chess.Board, square: int) -> tuple[int, ...]:
    """Opposing pieces the piece on `square` attacks that are worth a knight or more."""
    mover = board.piece_at(square)
    if mover is None or board.is_attacked_by(not mover.color, square):
        return ()  # a forking piece that can be captured does not fork anything
    return tuple(
        target
        for target in board.attacks(square)
        if (piece := board.piece_at(target)) is not None
        and piece.color != mover.color
        and (piece.piece_type == chess.KING or POINTS[piece.piece_type] >= 3)
    )


def fork_evidence(board: chess.Board, fen: str, ply: int, line: tuple[str, ...]) -> list[Evidence]:
    if not line:
        return []
    after = board.copy()
    first = chess.Move.from_uci(line[0])
    after.push(first)
    targets = fork_targets(after, first.to_square)
    if len(targets) < 2:
        return []
    squares = square_names(first.to_square, *sorted(targets))
    return [Evidence(evidence_id("fork", ply, squares), "fork", ply, fen, squares, line)]


def pin_evidence(board: chess.Board, fen: str, ply: int) -> list[Evidence]:
    found: list[Evidence] = []
    for color in (chess.WHITE, chess.BLACK):
        king = board.king(color)
        for square, piece in board.piece_map().items():
            if piece.color != color or piece.piece_type == chess.KING or king is None:
                continue
            if not board.is_pinned(color, square):
                continue
            pinner = next(
                (
                    sq
                    for sq in board.pin(color, square)
                    if (other := board.piece_at(sq)) is not None and other.color != color
                ),
                None,
            )
            if pinner is not None:
                squares = square_names(pinner, square, king)
                found.append(
                    Evidence(evidence_id("pin", ply, squares), "pin", ply, fen, squares, ())
                )
    return found[:MAX_PER_KIND]


def evidence_id(kind: str, ply: int, squares: tuple[str, ...]) -> str:
    return f"{kind}-{ply}-{'-'.join(squares)}"


def detect_evidence(
    *, fen: str, ply: int, continuation_uci: tuple[str, ...] = ()
) -> tuple[Evidence, ...]:
    """Return evidence for a position; the continuation must be legal from `fen`."""
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError("Invalid position")
    replay = board.copy()
    for uci in continuation_uci:
        move = chess.Move.from_uci(uci)
        if move not in replay.legal_moves:
            raise ValueError("Continuation is not legal from this position")
        replay.push(move)
    return (
        *hanging_evidence(board, fen, ply),
        *fork_evidence(board, fen, ply, continuation_uci),
        *pin_evidence(board, fen, ply),
    )
