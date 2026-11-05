"""Turn detector evidence into typed template blocks by naming real pieces and squares."""

import chess

from services.core.coaching.templates import SUPPORTED_KINDS, block
from services.core.coaching.values import EvidenceRecord, Level, TemplateBlock


def color_of(name: str) -> chess.Color:
    if name not in ("white", "black"):
        raise ValueError("Unknown color")
    return name == "white"


def piece_at(board: chess.Board, square_name: str) -> chess.Piece:
    piece = board.piece_at(chess.parse_square(square_name))
    if piece is None:
        raise ValueError("Evidence square is empty")
    return piece


def evidence_board(item: EvidenceRecord) -> chess.Board:
    """The board the evidence squares describe: after its first move for a fork."""
    board = chess.Board(item.fen)
    if not board.is_valid():
        raise ValueError("Invalid evidence position")
    if item.kind == "fork":
        move = chess.Move.from_uci(item.continuation_uci[0])
        if move not in board.legal_moves:
            raise ValueError("Evidence continuation is not legal")
        board.push(move)
    return board


def check_continuation(item: EvidenceRecord) -> None:
    board = chess.Board(item.fen)
    for uci in item.continuation_uci:
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            raise ValueError("Evidence continuation is not legal")
        board.push(move)


def roles(item: EvidenceRecord) -> tuple[str, str, chess.Color, dict[str, str]]:
    """Return (kind, attacker square, attacker color, typed values) for supported evidence."""
    if item.kind not in SUPPORTED_KINDS:
        raise ValueError("Unsupported evidence kind")
    check_continuation(item)
    board = evidence_board(item)
    attacker_square, target_square = item.squares[0], item.squares[1]
    attacker, target = piece_at(board, attacker_square), piece_at(board, target_square)
    values = {
        "attacker_piece": chess.piece_name(attacker.piece_type),
        "attacker_square": attacker_square,
        "target_piece": chess.piece_name(target.piece_type),
        "target_square": target_square,
    }
    if item.kind == "fork":
        second = piece_at(board, item.squares[2])
        values |= {
            "second_piece": chess.piece_name(second.piece_type),
            "second_square": item.squares[2],
        }
    if item.kind == "pin":
        values["king_square"] = item.squares[2]
    return item.kind, attacker_square, attacker.color, values


def evidence_block(item: EvidenceRecord, player: chess.Color, level: Level) -> TemplateBlock:
    """Describe the evidence from the player's side: opportunity or danger."""
    kind, _, attacker_color, values = roles(item)
    side = "opportunity" if attacker_color == player else "danger"
    return block(f"{kind.split('_')[0]}_{side}", (item.id,), level=level, **values)


def is_opportunity(item: EvidenceRecord, player: chess.Color) -> bool:
    return roles(item)[2] == player
