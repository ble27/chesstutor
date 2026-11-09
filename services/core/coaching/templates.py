"""Reviewed coaching templates, typed substitutions, and the only text renderer.

Every sentence the coach can show is in `TEMPLATES`. Substitution keys are typed
(`*_piece`, `*_square`, `level`, `move_number`); anything else is rejected, so
untrusted prose, URLs, markup, or notation cannot reach the output. Wording is
plain and coach-like: pieces and squares are named, not written as notation.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

from services.core.coaching.phrases import motif_templates
from services.core.coaching.values import Level, TemplateBlock

REFUSAL = (
    "I can help with chess moves, positions, rules, and improvement. "
    "Choose a chess question about this game."
)
PIECES = frozenset({"pawn", "knight", "bishop", "rook", "queen", "king"})
SQUARE = re.compile(r"^[a-h][1-8]$")
NUMBER = re.compile(r"^[0-9]{1,3}$")
NOT_ENOUGH = (
    "There isn't enough verified evidence here to explain this confidently. "
    "Run a Deep analysis for a closer look."
)


def both(beginner: str, intermediate: str | None = None) -> dict[Level, str]:
    return {"beginner": beginner, "intermediate": intermediate or beginner}


TEMPLATES: dict[str, dict[Level, str]] = {
    "refusal": both(REFUSAL),
    "uncertain_deep": both(NOT_ENOUGH),
    "no_threat": both("No verified threat against you was found in this position."),
    "hanging_opportunity": both(
        "Your {attacker_piece} on {attacker_square} can capture the opponent's "
        "{target_piece} on {target_square}, and nothing protects it. Free pieces are worth taking.",
        "Your {attacker_piece} on {attacker_square} attacks an undefended "
        "{target_piece} on {target_square}, so it can be won for free.",
    ),
    "hanging_danger": both(
        "The opponent's {attacker_piece} on {attacker_square} can capture your "
        "{target_piece} on {target_square}, and nothing protects it.",
        "Your {target_piece} on {target_square} is undefended and attacked by the "
        "opponent's {attacker_piece} on {attacker_square}.",
    ),
    "fork_opportunity": both(
        "Moving your {attacker_piece} to {attacker_square} attacks the opponent's "
        "{target_piece} on {target_square} and {second_piece} on {second_square} at the same "
        "time, which is hard to defend against.",
        "A {attacker_piece} on {attacker_square} forks the {target_piece} on {target_square} "
        "and the {second_piece} on {second_square}.",
    ),
    "fork_danger": both(
        "The opponent's {attacker_piece} on {attacker_square} attacks your {target_piece} on "
        "{target_square} and {second_piece} on {second_square} at the same time.",
        "The opponent's {attacker_piece} on {attacker_square} forks your {target_piece} on "
        "{target_square} and {second_piece} on {second_square}.",
    ),
    "pin_opportunity": both(
        "Your {attacker_piece} on {attacker_square} pins the opponent's {target_piece} on "
        "{target_square} against the king on {king_square}, so it cannot move off that line.",
        "Your {attacker_piece} on {attacker_square} pins the {target_piece} on "
        "{target_square} to the king on {king_square}.",
    ),
    "pin_danger": both(
        "The opponent's {attacker_piece} on {attacker_square} pins your {target_piece} on "
        "{target_square} against your king on {king_square}, so it cannot move off that line.",
        "Your {target_piece} on {target_square} is pinned to your king on {king_square} by the "
        "opponent's {attacker_piece} on {attacker_square}.",
    ),
    "better_hanging_piece": both(
        "A stronger idea is to capture the {target_piece} on {target_square} with your "
        "{attacker_piece} from {attacker_square}.",
        "Capturing the undefended {target_piece} on {target_square} with your "
        "{attacker_piece} is stronger.",
    ),
    "better_fork": both(
        "A stronger idea is to move your {attacker_piece} to {attacker_square}, attacking two "
        "pieces at once.",
        "Moving your {attacker_piece} to {attacker_square} forks two pieces.",
    ),
    "improve_loose_pieces": both(
        "Practice checking that every piece is protected before you move. This came up around "
        "move {move_number} of this game.",
        "Loose pieces cost you here, around move {move_number}. Check protection before each move.",
    ),
    "improve_forks": both(
        "Practice looking for moves that attack two pieces at once. This came up around "
        "move {move_number} of this game.",
        "Forks decided the play around move {move_number}. Look for double attacks.",
    ),
    "improve_pins": both(
        "Practice spotting pieces that are stuck in front of their king. This came up around "
        "move {move_number} of this game.",
        "Pins mattered around move {move_number}. Watch for pieces tied to the king.",
    ),
    "rule_castling": both(
        "Castling moves your king two squares toward a rook and puts that rook next to it. "
        "It is allowed only if neither piece has moved, the squares between are empty, and the "
        "king is not in check or passing through an attacked square."
    ),
    "rule_en_passant": both(
        "En passant lets a pawn capture an enemy pawn that has just moved two squares past it, "
        "as if it had moved one square. It must be done on the very next move."
    ),
    "rule_promotion": both(
        "When a pawn reaches the far side of the board it must become a queen, rook, bishop, "
        "or knight of its own color."
    ),
    "rule_check": both(
        "A king in check must escape on the next move by moving away, blocking, or capturing "
        "the attacker. A move that leaves your own king in check is not legal."
    ),
    "rule_stalemate": both(
        "Stalemate is a draw: the player to move has no legal move and is not in check."
    ),
    "rule_general": both(
        "Each piece moves in its own way, and a move is legal only if it does not leave your "
        "own king in check."
    ),
    **{
        f"lesson_{name}": both(text, tech)
        for name, text, tech in (
            (
                "miss_material",
                "This was a missed chance to win material: a stronger move was available.",
                "A line winning material was available and was missed.",
            ),
            (
                "mistake_hanging",
                "This move is a mistake because it leaves your {target_piece} on "
                "{target_square} undefended, so the opponent's {attacker_piece} on "
                "{attacker_square} can capture it.",
                "Mistake: the {target_piece} on {target_square} is left undefended against the "
                "opponent's {attacker_piece} on {attacker_square}.",
            ),
            (
                "blunder_hanging",
                "This move is a blunder because it leaves your {target_piece} on "
                "{target_square} undefended, so the opponent's {attacker_piece} on "
                "{attacker_square} can capture it.",
                "Blunder: the {target_piece} on {target_square} is left undefended against the "
                "opponent's {attacker_piece} on {attacker_square}.",
            ),
            (
                "mistake_general",
                "This move is a mistake: the opponent gets a clear edge from it, and a stronger "
                "option was available.",
                "Mistake: a noticeably better option was available.",
            ),
            (
                "blunder_general",
                "This move is a blunder: it hands the opponent a big edge, and a much "
                "stronger option was available.",
                "Blunder: this gives up a large part of your advantage.",
            ),
            (
                "great",
                "Well played! Every other move here gives away part of your advantage, so this "
                "was the one to find.",
                "Great move: it was the only move that kept the position in good shape.",
            ),
            (
                "brilliant",
                "A bold idea! You gave up material on purpose, and the follow-up checks suggest "
                "it pays off.",
                "A sacrifice that the engine's follow-up checks support.",
            ),
        )
    },
    **{
        f"alt_{name}": both(text)
        for name, text in (
            (
                "mate",
                "Consider moving your {piece} from {from_square} to {to_square}, "
                "which is checkmate.",
            ),
            (
                "check",
                "Consider moving your {piece} from {from_square} to {to_square}, "
                "which gives check.",
            ),
            (
                "capture",
                "Consider moving your {piece} from {from_square} to {to_square}, which captures "
                "the opponent's {captured_piece}.",
            ),
            (
                "safe",
                "Consider moving your {piece} from {from_square} to {to_square}, which leaves none "
                "of your pieces undefended.",
            ),
            (
                "best",
                "Consider moving your {piece} from {from_square} to {to_square}, which is the "
                "strongest option here.",
            ),
        )
    },
}
TEMPLATES.update(motif_templates())
SUPPORTED_KINDS = frozenset({"hanging_piece", "fork", "pin"})
UNSUPPORTED_THEMES = (
    "skewer",
    "discovered_attack",
    "mate_threat",
    "development",
    "king_safety",
    "center_control",
    "pawn_structure",
    "piece_activity",
    "exchange",
    "endgame",
)


@dataclass(frozen=True)
class TemplateChoice:
    status: str
    template_id: str | None
    reviewed: bool
    reason: str | None


class RenderableBlock(Protocol):
    @property
    def template_id(self) -> str: ...
    @property
    def values(self) -> Mapping[str, object]: ...


class RenderableResult(Protocol):
    @property
    def blocks(self) -> Sequence[RenderableBlock]: ...


def template_for_evidence(*, kind: str, level: Level) -> TemplateChoice:
    """Map a feature kind to its reviewed opportunity template, or say it is unsupported."""
    if level not in ("beginner", "intermediate"):
        raise ValueError("Unknown explanation level")
    if kind in SUPPORTED_KINDS:
        return TemplateChoice("supported", f"{kind.split('_')[0]}_opportunity", True, None)
    return TemplateChoice(
        "unsupported", None, False, "No reviewed detector exists for this theme yet."
    )


def valid_value(key: str, value: object) -> bool:
    if not isinstance(value, str):
        return False
    if key == "level":
        return value in ("beginner", "intermediate")
    if key == "file":
        return bool(re.fullmatch(r"[a-h]", value))
    if key == "move_number":
        return bool(NUMBER.match(value))
    if key == "square" or key.endswith("_square"):
        return bool(SQUARE.match(value))
    if key == "piece" or key.endswith("_piece"):
        return value in PIECES
    return False


def render_block(block: RenderableBlock) -> str:
    template = TEMPLATES.get(block.template_id)
    if template is None:
        raise ValueError("Unreviewed template")
    for key, value in block.values.items():
        if not valid_value(key, value):
            raise ValueError(f"Rejected substitution: {key}")
    level: Level = "intermediate" if block.values.get("level") == "intermediate" else "beginner"
    try:
        return template[level].format(**block.values)
    except KeyError as error:
        raise ValueError("Missing typed substitution") from error


def render_blocks(blocks: Sequence[RenderableBlock]) -> str:
    return " ".join(render_block(block) for block in blocks)


def render_coaching(result: RenderableResult) -> str:
    """Render reviewed templates and typed chess values only."""
    return render_blocks(result.blocks)


def block(template_id: str, evidence_ids: tuple[str, ...], **values: str) -> TemplateBlock:
    return TemplateBlock(template_id, evidence_ids, values)
