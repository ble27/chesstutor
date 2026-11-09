"""Per-ply lessons and PV arrows for notable plies only.

Annotated: Miss, Mistake, Blunder, and Great/Brilliant badges. Routine plies stay
quiet. Every claim comes from replayable evidence; text is plain language and the
suggested moves come only from legal, complete engine lines, close to the best.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

import chess

from services.core.analysis.values import Color, EngineLine, MoveEvidence, Wdl
from services.core.classification.base import expected_for_mover
from services.core.classification.cost import tactical_cost
from services.core.classification.review import ReviewedMove, legal_line
from services.core.coaching.detectors import detect_evidence
from services.core.coaching.facts import color_of
from services.core.coaching.motifs import Motif, flaw_cause, move_motifs, named
from services.core.coaching.phrases import GOOD, MISS_KINDS, SACRIFICE_KINDS
from services.core.coaching.templates import block, render_blocks
from services.core.coaching.values import Evidence, Level, TemplateBlock

LessonKind = Literal["miss", "mistake", "blunder", "great", "brilliant"]
FLAW_KINDS = ("miss", "mistake", "blunder")
MAX_ALTERNATIVES = 2
CLOSE_TO_BEST = Fraction(1, 20)  # beginners are offered playable, not engine-perfect, moves


@dataclass(frozen=True)
class Arrow:
    kind: Literal["played", "suggested"]
    rank: int
    from_square: str
    to_square: str
    uci: str


@dataclass(frozen=True)
class Alternative:
    rank: int
    uci: str
    description: str
    block: TemplateBlock


@dataclass(frozen=True)
class Lesson:
    ply: int
    kind: LessonKind
    level: Level
    blocks: tuple[TemplateBlock, ...]
    alternatives: tuple[Alternative, ...]
    arrows: tuple[Arrow, ...]


def lesson_kind(move: ReviewedMove) -> LessonKind | None:
    if "brilliant" in move.badges:
        return "brilliant"
    if "great" in move.badges:
        return "great"
    if "miss" in move.badges:
        return "miss"
    if move.label == "mistake":
        return "mistake"
    return "blunder" if move.label == "blunder" else None


def hanging_after(board: chess.Board, mover: chess.Color, ply: int) -> Evidence | None:
    """An undefended piece of the mover that the side now to move can capture."""
    for item in detect_evidence(fen=board.fen(), ply=ply, continuation_uci=()):
        if (
            item.kind == "hanging_piece"
            and board.color_at(chess.parse_square(item.squares[1])) == mover
        ):
            return item
    return None


def capture_values(board: chess.Board, item: Evidence) -> dict[str, str]:
    attacker = board.piece_at(chess.parse_square(item.squares[0]))
    target = board.piece_at(chess.parse_square(item.squares[1]))
    if attacker is None or target is None:
        raise ValueError("Evidence square is empty")
    return {
        "attacker_piece": chess.piece_name(attacker.piece_type),
        "attacker_square": item.squares[0],
        "target_piece": chess.piece_name(target.piece_type),
        "target_square": item.squares[1],
    }


def best_move(evidence: MoveEvidence, root: chess.Board) -> chess.Move | None:
    """The engine's first choice, only when its line replays legally."""
    if not evidence.best or not legal_line(root, evidence.best[0]):
        return None
    return chess.Move.from_uci(evidence.best[0].pv[0].uci)


def good_motif(root: chess.Board, move: chess.Move | None, kinds: Sequence[str]) -> Motif | None:
    if move is None:
        return None
    return next((m for m in move_motifs(root, move) if m.kind in kinds), None)


def miss_block(
    move: ReviewedMove, evidence: MoveEvidence, root: chess.Board, level: Level
) -> TemplateBlock:
    proof = next((p for p in move.proofs if p.badge == "miss"), None)
    ids = (proof.id,) if proof else ()
    best = best_move(evidence, root)
    motif = good_motif(root, best, MISS_KINDS)
    if motif is not None:
        return block(f"lesson_miss_{motif.kind}", ids, level=level, **motif.values)
    piece = root.piece_at(best.from_square) if best else None
    if proof is not None and proof.motif == "forced_mate" and best and piece:
        values = named(piece, best.to_square, "attacker")
        return block("lesson_miss_forced_mate", ids, level=level, **values)
    return block("lesson_miss_material", ids, level=level)


def reply_move(evidence: MoveEvidence, root: chess.Board) -> chess.Move | None:
    """The opponent's reply in the engine's line for the played move, if it replays legally."""
    if len(evidence.played.pv) < 2 or not legal_line(root, evidence.played):
        return None
    return chess.Move.from_uci(evidence.played.pv[1].uci)


def flaw_block(
    kind: str, move: ReviewedMove, evidence: MoveEvidence, root: chess.Board, level: Level
) -> TemplateBlock:
    played = chess.Move.from_uci(evidence.played_uci)
    cause = flaw_cause(root, played, reply_move(evidence, root), tactical_cost(root, evidence))
    if cause is not None:
        return block(f"lesson_{kind}_{cause.kind}", (), level=level, **cause.values)
    after = root.copy()
    after.push(played)
    item = hanging_after(after, color_of(move.mover), move.ply)
    if item is None:
        return block(f"lesson_{kind}_general", (), level=level)
    return block(f"lesson_{kind}_hanging", (item.id,), level=level, **capture_values(after, item))


def praise_block(
    kind: str, move: ReviewedMove, evidence: MoveEvidence, root: chess.Board, level: Level
) -> TemplateBlock:
    ids = tuple(p.id for p in move.proofs)
    played = chess.Move.from_uci(evidence.played_uci)
    motif = good_motif(root, played, SACRIFICE_KINDS if kind == "brilliant" else tuple(GOOD))
    if motif is None:
        return block(f"lesson_{kind}", ids, level=level)
    return block(f"lesson_{kind}_{motif.kind}", ids, level=level, **motif.values)


def main_block(
    kind: LessonKind, move: ReviewedMove, evidence: MoveEvidence, level: Level
) -> TemplateBlock:
    root = chess.Board(evidence.root_fen)
    if kind == "miss":
        return miss_block(move, evidence, root, level)
    if kind in ("great", "brilliant"):
        return praise_block(kind, move, evidence, root, level)
    return flaw_block(kind, move, evidence, root, level)


def usable_lines(evidence: MoveEvidence, root: chess.Board) -> list[EngineLine]:
    """Complete, legally replayable best lines whose first move differs from the played move."""
    return [
        line
        for line in evidence.best
        if not line.bounded and legal_line(root, line) and line.pv[0].uci != evidence.played_uci
    ]


def close_to_best(
    lines: list[EngineLine], reference_wdl: Wdl | None, mover: Color
) -> list[EngineLine]:
    """Keep usable lines within a playable margin of the engine's true best expected score.

    The reference is the engine's top line even when that line is unusable (bounded or
    illegal), so a weaker line is never offered just because the best one was dropped.
    """
    if reference_wdl is None:
        return lines[:1]
    reference = expected_for_mover(reference_wdl, mover)
    return [
        line
        for line in lines
        if line.wdl is not None and reference - expected_for_mover(line.wdl, mover) <= CLOSE_TO_BEST
    ]


def alternative_template(
    root: chess.Board, uci: str, played_was_unsafe: bool
) -> tuple[str, dict[str, str]]:
    move = chess.Move.from_uci(uci)
    piece = root.piece_at(move.from_square)
    if piece is None:
        raise ValueError("No piece on the move's origin square")
    values = {
        "piece": chess.piece_name(piece.piece_type),
        "from_square": chess.square_name(move.from_square),
        "to_square": chess.square_name(move.to_square),
    }
    captured = root.piece_at(move.to_square)
    after = root.copy()
    after.push(move)
    if after.is_checkmate():
        return "alt_mate", values
    if after.is_check():
        return "alt_check", values
    if captured is not None:
        return "alt_capture", values | {"captured_piece": chess.piece_name(captured.piece_type)}
    if played_was_unsafe and hanging_after(after, root.turn, 0) is None:
        return "alt_safe", values
    return "alt_best", values


def alternatives(evidence: MoveEvidence, unsafe: bool, level: Level) -> tuple[Alternative, ...]:
    root = chess.Board(evidence.root_fen)
    reference = evidence.best[0].wdl if evidence.best else None
    lines = close_to_best(usable_lines(evidence, root), reference, evidence.mover)
    unique: dict[str, EngineLine] = {}
    for line in lines:
        unique.setdefault(line.pv[0].uci, line)
    found: list[Alternative] = []
    for rank, uci in enumerate(list(unique)[:MAX_ALTERNATIVES], start=1):
        template, values = alternative_template(root, uci, unsafe)
        item = block(template, (), level=level, **values)
        found.append(Alternative(rank, uci, render_blocks((item,)), item))
    return tuple(found)


def make_arrow(kind: Literal["played", "suggested"], rank: int, uci: str) -> Arrow:
    return Arrow(kind, rank, uci[:2], uci[2:4], uci)


def build_lesson(move: ReviewedMove, evidence: MoveEvidence, level: Level) -> Lesson | None:
    """A lesson for a notable ply, or None when the ply is routine."""
    kind = lesson_kind(move)
    if kind is None:
        return None
    main = main_block(kind, move, evidence, level)
    suggestions: tuple[Alternative, ...] = ()
    if kind in FLAW_KINDS:
        unsafe = main.template_id.endswith("_hanging")
        suggestions = alternatives(evidence, unsafe, level)
    arrows = (
        make_arrow("played", 0, evidence.played_uci),
        *(make_arrow("suggested", item.rank, item.uci) for item in suggestions),
    )
    return Lesson(move.ply, kind, level, (main,), suggestions, arrows)


def build_lessons(
    pairs: Sequence[tuple[ReviewedMove, MoveEvidence]], level: Level
) -> tuple[Lesson, ...]:
    """Lessons for only the notable plies of a game, in game order."""
    lessons = (build_lesson(move, evidence, level) for move, evidence in pairs)
    return tuple(lesson for lesson in lessons if lesson is not None)


def render_lesson(lesson: Lesson) -> str:
    """The main explanation followed by the plain-language alternatives."""
    return " ".join([render_blocks(lesson.blocks), *(a.description for a in lesson.alternatives)])
