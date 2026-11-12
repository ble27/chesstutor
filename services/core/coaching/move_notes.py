"""Policy explanations for a selected ply; notable annotations stay selective."""

from collections.abc import Sequence

import chess

from services.core.analysis.values import MoveEvidence
from services.core.classification.review import ReviewedMove
from services.core.coaching.lessons import Lesson, build_lesson
from services.core.coaching.templates import block
from services.core.coaching.values import Level


def move_note(move: ReviewedMove, evidence: MoveEvidence, level: Level) -> Lesson:
    notable = build_lesson(move, evidence, level)
    if notable is not None:
        return notable
    root = chess.Board(evidence.root_fen)
    played = chess.Move.from_uci(evidence.played_uci)
    piece = root.piece_at(played.from_square)
    if piece is None or played not in root.legal_moves:
        raise ValueError("A selected-move explanation requires a legal played move")
    context = block(
        "played_move",
        (),
        level=level,
        piece=chess.piece_name(piece.piece_type),
        from_square=chess.square_name(played.from_square),
        to_square=chess.square_name(played.to_square),
    )
    reason = block(f"selected_{move.label}", (), level=level)
    return Lesson(move.ply, move.label, level, (context, reason), (), ())


def move_notes(
    pairs: Sequence[tuple[ReviewedMove, MoveEvidence]], level: Level
) -> tuple[Lesson, ...]:
    return tuple(move_note(move, evidence, level) for move, evidence in pairs)
