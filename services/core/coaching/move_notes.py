"""Policy explanations for a selected ply; notable annotations stay selective."""

from collections.abc import Sequence

import chess

from services.core.analysis.values import MoveEvidence
from services.core.classification.review import ReviewedMove
from services.core.coaching.lessons import Lesson, best_move, build_lesson
from services.core.coaching.templates import block
from services.core.coaching.values import Level, TemplateBlock


def move_note(move: ReviewedMove, evidence: MoveEvidence, level: Level) -> Lesson:
    notable = build_lesson(move, evidence, level)
    if notable is not None:
        return notable
    root = chess.Board(evidence.root_fen)
    played = chess.Move.from_uci(evidence.played_uci)
    piece = root.piece_at(played.from_square)
    if piece is None or played not in root.legal_moves:
        raise ValueError("A selected-move explanation requires a legal played move")
    notes = [played_detail(root, played, piece, level)]
    if move.label in ("forced", "unclassified"):
        notes.append(block(f"selected_{move.label}", (), level=level))
    if move.label == "inaccuracy":
        best = best_move(evidence, root)
        option = root.piece_at(best.from_square) if best is not None else None
        if best and best != played and option and not evidence.best[0].bounded:
            notes.append(block("selected_inaccuracy", (), level=level, **move_values(best, option)))
    return Lesson(move.ply, move.label, level, tuple(notes), (), ())


def move_values(move: chess.Move, piece: chess.Piece) -> dict[str, str]:
    return {
        "piece": chess.piece_name(piece.piece_type),
        "from_square": chess.square_name(move.from_square),
        "to_square": chess.square_name(move.to_square),
    }


def played_detail(
    root: chess.Board, move: chess.Move, piece: chess.Piece, level: Level
) -> TemplateBlock:
    values = move_values(move, piece)
    if move.promotion:
        return block(
            "played_promotion",
            (),
            level=level,
            target_piece=chess.piece_name(move.promotion),
            **values,
        )
    if root.is_castling(move):
        return block("played_castle", (), level=level, **values)
    if root.is_en_passant(move):
        return block("played_en_passant", (), level=level, **values)
    captured = root.piece_at(move.to_square)
    if captured:
        return block(
            "played_capture",
            (),
            level=level,
            target_piece=chess.piece_name(captured.piece_type),
            **values,
        )
    if root.gives_check(move):
        return block("played_check", (), level=level, **values)
    if piece.piece_type == chess.PAWN and move.to_square in (
        chess.D4,
        chess.E4,
        chess.D5,
        chess.E5,
    ):
        attacks = chess.SquareSet(chess.BB_PAWN_ATTACKS[piece.color][move.to_square])
        first, second = map(chess.square_name, attacks)
        return block(
            "played_center_pawn",
            (),
            level=level,
            first_square=first,
            second_square=second,
            **values,
        )
    home_rank = 0 if piece.color == chess.WHITE else 7
    if (
        piece.piece_type in (chess.KNIGHT, chess.BISHOP)
        and chess.square_rank(move.from_square) == home_rank
        and chess.square_rank(move.to_square) != home_rank
    ):
        return block("played_development", (), level=level, **values)
    return block("played_move", (), level=level, **values)


def move_notes(
    pairs: Sequence[tuple[ReviewedMove, MoveEvidence]], level: Level
) -> tuple[Lesson, ...]:
    return tuple(move_note(move, evidence, level) for move, evidence in pairs)
