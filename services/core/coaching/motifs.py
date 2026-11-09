"""Plain-language reasons for a move, each proved by the board (not guessed).

`move_motifs` answers "what does this move do?" (check, fork, skewer, open file...).
`flaw_cause` answers "what does this move allow?" by reading the opponent's reply in
the engine's own line. A reason is returned only when the position proves it; a quiet
move has no motif, and callers fall back to a more general sentence.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

import chess

from services.core.classification.base import TacticalCost
from services.core.coaching.detectors import POINTS, fork_targets, wins_material

SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)
CENTER = (chess.D4, chess.E4, chess.D5, chess.E5)
HOME_MINORS = {
    chess.WHITE: (chess.B1, chess.G1, chess.C1, chess.F1),
    chess.BLACK: (chess.B8, chess.G8, chess.C8, chess.F8),
}
OPENING_FULLMOVES = 15


@dataclass(frozen=True)
class Motif:
    kind: str
    values: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Played:
    """A legal move seen from the side that plays it."""

    board: chess.Board
    after: chess.Board
    move: chess.Move
    piece: chess.Piece

    @property
    def side(self) -> chess.Color:
        return self.piece.color

    @property
    def to(self) -> int:
        return self.move.to_square


Detector = Callable[[Played], Motif | None]


def piece_name(piece: chess.Piece) -> str:
    return chess.piece_name(piece.piece_type)


def named(piece: chess.Piece, square: int, prefix: str) -> dict[str, str]:
    return {f"{prefix}_piece": piece_name(piece), f"{prefix}_square": chess.square_name(square)}


def mate(item: Played) -> Motif | None:
    if item.after.is_checkmate():
        return Motif("mate", named(item.piece, item.to, "attacker"))
    return None


def capture(item: Played) -> Motif | None:
    target = item.board.piece_at(item.to)
    if target is None or target.piece_type == chess.KING:
        return None
    values = named(item.piece, item.move.from_square, "attacker") | named(target, item.to, "target")
    free = not item.board.is_attacked_by(target.color, item.to)
    return Motif("capture_free" if free else "capture", values)


def ray_beyond(
    board: chess.Board, start: int, over: int
) -> chess.Piece | tuple[int, chess.Piece] | None:
    """The first piece past `over` on the line from `start` through `over`."""
    file_step = (chess.square_file(over) > chess.square_file(start)) - (
        chess.square_file(over) < chess.square_file(start)
    )
    rank_step = (chess.square_rank(over) > chess.square_rank(start)) - (
        chess.square_rank(over) < chess.square_rank(start)
    )
    file, rank = chess.square_file(over) + file_step, chess.square_rank(over) + rank_step
    while 0 <= file < 8 and 0 <= rank < 8:
        square = chess.square(file, rank)
        found = board.piece_at(square)
        if found is not None:
            return square, found
        file, rank = file + file_step, rank + rank_step
    return None


def safe_on_arrival(item: Played) -> bool:
    return not item.after.is_attacked_by(not item.side, item.to)


def skewer(item: Played) -> Motif | None:
    if item.piece.piece_type not in SLIDERS or not safe_on_arrival(item):
        return None
    for front_square in item.after.attacks(item.to):
        front = item.after.piece_at(front_square)
        if front is None or front.color == item.side:
            continue
        beyond = ray_beyond(item.after, item.to, front_square)
        if not isinstance(beyond, tuple):
            continue
        back_square, back = beyond
        front_worth = 99 if front.piece_type == chess.KING else POINTS[front.piece_type]
        if (
            back.color != item.side
            and POINTS[back.piece_type] >= 3
            and front_worth > POINTS[back.piece_type]
        ):
            return Motif(
                "skewer",
                named(item.piece, item.to, "attacker")
                | named(front, front_square, "target")
                | named(back, back_square, "second"),
            )
    return None


def pin(item: Played) -> Motif | None:
    if item.piece.piece_type not in SLIDERS:
        return None
    enemy = not item.side
    for square in item.after.attacks(item.to):
        target = item.after.piece_at(square)
        if target is None or target.color != enemy or target.piece_type == chess.KING:
            continue
        pinned_by_us = (
            POINTS[target.piece_type] >= 3
            and item.after.is_pinned(enemy, square)
            and item.to in item.after.pin(enemy, square)
        )
        if pinned_by_us:
            king = item.after.king(enemy)
            values = named(item.piece, item.to, "attacker") | named(target, square, "target")
            return Motif("pin", values | {"king_square": chess.square_name(king or square)})
    return None


def fork(item: Played) -> Motif | None:
    targets = sorted(
        fork_targets(item.after, item.to),
        key=lambda square: (
            -(
                99
                if item.after.piece_type_at(square) == chess.KING
                else POINTS[item.after.piece_type_at(square) or 0]
            )
        ),
    )
    pieces = [item.after.piece_at(square) for square in targets]
    if len(targets) < 2 or pieces[0] is None or pieces[1] is None:
        return None
    return Motif(
        "fork",
        named(item.piece, item.to, "attacker")
        | named(pieces[0], targets[0], "target")
        | named(pieces[1], targets[1], "second"),
    )


def discovered(item: Played) -> Motif | None:
    """A friendly slider (not the moved piece) that now attacks something worth winning."""
    for square, slider in item.after.piece_map().items():
        if slider.color != item.side or slider.piece_type not in SLIDERS or square == item.to:
            continue
        for target_square in item.after.attacks(square) - item.board.attacks(square):
            target = item.after.piece_at(target_square)
            if target is None or target.color == item.side:
                continue
            if target.piece_type == chess.KING:
                kind = "discovered_check"
            elif wins_material(item.after, slider, target_square):
                kind = "discovered"
            else:
                continue
            return Motif(
                kind, named(slider, square, "attacker") | named(target, target_square, "target")
            )
    return None


def check(item: Played) -> Motif | None:
    if item.after.is_check() and item.to in item.after.checkers():
        return Motif("check", named(item.piece, item.to, "attacker"))
    return None


def threatened(board: chess.Board, color: chess.Color) -> dict[int, chess.Piece]:
    """The color's pieces worth at least a minor piece that the opponent could win."""
    found: dict[int, chess.Piece] = {}
    for square, piece in board.piece_map().items():
        if piece.color != color or POINTS[piece.piece_type] < 3:
            continue
        attackers = board.attackers(not color, square)
        undefended = not board.is_attacked_by(color, square)
        cheaper = any(
            0 < POINTS[board.piece_type_at(a) or 0] < POINTS[piece.piece_type] for a in attackers
        )
        if attackers and (undefended or cheaper):
            found[square] = piece
    return found


def save_piece(item: Played) -> Motif | None:
    before = threatened(item.board, item.side)
    after = threatened(item.after, item.side)
    for square, piece in sorted(before.items(), key=lambda pair: -POINTS[pair[1].piece_type]):
        new_square = item.to if square == item.move.from_square else square
        if new_square not in after:
            return Motif("save_piece", named(piece, square, "target"))
    return None


def threat(item: Played) -> Motif | None:
    if not safe_on_arrival(item):
        return None
    new = item.after.attacks(item.to) - item.board.attacks(item.move.from_square)
    for square in new:
        target = item.after.piece_at(square)
        if target is None or target.color == item.side or target.piece_type == chess.KING:
            continue
        if POINTS[target.piece_type] >= 3 and not item.after.is_attacked_by(target.color, square):
            return Motif(
                "threat", named(item.piece, item.to, "attacker") | named(target, square, "target")
            )
    return None


def open_file(item: Played) -> Motif | None:
    if item.piece.piece_type not in (chess.ROOK, chess.QUEEN):
        return None
    file = chess.square_file(item.to)
    if file == chess.square_file(item.move.from_square):
        return None
    pawns = item.after.pieces(chess.PAWN, chess.WHITE) | item.after.pieces(chess.PAWN, chess.BLACK)
    if any(chess.square_file(square) == file for square in pawns):
        return None
    return Motif(
        "open_file", named(item.piece, item.to, "attacker") | {"file": chess.FILE_NAMES[file]}
    )


def castle(item: Played) -> Motif | None:
    return Motif("castle") if item.board.is_castling(item.move) else None


def center_pawn(item: Played) -> Motif | None:
    if item.piece.piece_type == chess.PAWN and item.to in CENTER:
        return Motif("center_pawn", named(item.piece, item.to, "attacker"))
    return None


def develop(item: Played) -> Motif | None:
    home = item.move.from_square in HOME_MINORS[item.side]
    minor = item.piece.piece_type in (chess.KNIGHT, chess.BISHOP)
    if minor and home and item.board.fullmove_number <= OPENING_FULLMOVES:
        return Motif("develop", named(item.piece, item.to, "attacker"))
    return None


DETECTORS: tuple[Detector, ...] = (
    mate, capture, skewer, pin, fork, discovered, check, save_piece, threat,
    open_file, castle, center_pawn, develop,
)  # fmt: skip


def move_motifs(board: chess.Board, move: chess.Move) -> list[Motif]:
    """Every proven reason for a legal move, strongest first; empty for a quiet move."""
    piece = board.piece_at(move.from_square)
    if piece is None or move not in board.legal_moves:
        raise ValueError("Move is not legal from this position")
    after = board.copy()
    after.push(move)
    item = Played(board, after, move, piece)
    return [found for detector in DETECTORS if (found := detector(item)) is not None]


def weakens_king(board: chess.Board, move: chess.Move) -> bool:
    """A pawn in front of the king, or a king walk, that is not castling."""
    piece = board.piece_at(move.from_square)
    king = board.king(piece.color) if piece else None
    if piece is None or king is None or board.is_castling(move):
        return False
    if piece.piece_type == chess.KING:
        return True
    near_file = abs(chess.square_file(move.from_square) - chess.square_file(king)) <= 1
    near_rank = abs(chess.square_rank(move.from_square) - chess.square_rank(king)) <= 2
    return piece.piece_type == chess.PAWN and near_file and near_rank


FLAW_KINDS_NEEDING_MATERIAL = ("capture", "fork", "skewer", "pin", "discovered", "discovered_check")


def flaw_cause(
    root: chess.Board, played: chess.Move, reply: chess.Move | None, cost: TacticalCost
) -> Motif | None:
    """What the played move allows, from the opponent's reply in the engine's line."""
    after = root.copy()
    after.push(played)
    if reply is None or reply not in after.legal_moves:
        return None
    motifs = {m.kind: m for m in move_motifs(after, reply)}
    if cost.allows_mate and (piece := after.piece_at(reply.from_square)) is not None:
        return Motif("mate", named(piece, reply.to_square, "attacker"))
    for kind in ("capture_free", *FLAW_KINDS_NEEDING_MATERIAL):
        if kind in motifs and (kind == "capture_free" or cost.material_points >= 1):
            return relabel(motifs[kind])
    if "center_pawn" in motifs:
        return Motif("center", motifs["center_pawn"].values)
    if "check" in motifs and weakens_king(root, played):
        return Motif("king", motifs["check"].values)
    piece = after.piece_at(reply.from_square)
    if piece is None or piece.piece_type in (chess.PAWN, chess.KING):
        return None  # naming a pawn or king step as "the cause" would not teach anything
    return Motif("reply", named(piece, reply.to_square, "attacker"))


def relabel(motif: Motif) -> Motif:
    kinds = {"capture_free": "hanging"}
    return Motif(kinds.get(motif.kind, motif.kind), motif.values)
