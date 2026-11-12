"""Reviewed sentence fragments for motif-specific lessons (typed substitutions only)."""

from services.core.coaching.values import Level

GOOD = {
    "mate": "Your {attacker_piece} to {attacker_square} is checkmate.",
    "capture_free": "Your {attacker_piece} on {attacker_square} takes the undefended "
    "{target_piece} on {target_square}, winning material for free.",
    "capture": "Your {attacker_piece} on {attacker_square} captures the opponent's "
    "{target_piece} on {target_square}.",
    "skewer": "Your {attacker_piece} on {attacker_square} attacks the {target_piece} on "
    "{target_square}, and when it moves the {second_piece} on {second_square} behind it is "
    "lost (a skewer).",
    "pin": "Your {attacker_piece} on {attacker_square} pins the opponent's {target_piece} on "
    "{target_square} to the king on {king_square}, so it cannot move off that line.",
    "fork": "Your {attacker_piece} on {attacker_square} attacks the opponent's {target_piece} "
    "on {target_square} and {second_piece} on {second_square} at the same time (a fork).",
    "discovered_check": "Moving this piece uncovers a check from your {attacker_piece} on "
    "{attacker_square} (a discovered check).",
    "discovered": "Moving this piece uncovers an attack from your {attacker_piece} on "
    "{attacker_square} on the {target_piece} on {target_square} (a discovered attack).",
    "check": "Your {attacker_piece} gives check from {attacker_square}, forcing the opponent "
    "to respond.",
    "save_piece": "It rescues your {target_piece} on {target_square}, which was under attack.",
    "threat": "Your {attacker_piece} on {attacker_square} now attacks the undefended "
    "{target_piece} on {target_square}.",
    "open_file": "Your {attacker_piece} on {attacker_square} takes the open {file}-file, where "
    "no pawn can block it.",
    "castle": "Castling tucks your king away and brings your rook into the game.",
    "center_pawn": "Your pawn on {attacker_square} stakes a claim in the center.",
    "develop": "It brings your {attacker_piece} into the game on {attacker_square}.",
}
SACRIFICE_KINDS = (
    "mate", "skewer", "pin", "fork", "discovered_check", "discovered", "check", "threat",
)  # fmt: skip
MISS_KINDS = (
    "mate", "capture_free", "capture", "skewer", "pin", "fork", "discovered_check", "discovered",
)  # fmt: skip

FLAW = {
    "mate": "allows a forced checkmate, starting with the opponent's {attacker_piece} to "
    "{attacker_square}.",
    "capture": "lets the opponent's {attacker_piece} on {attacker_square} capture your "
    "{target_piece} on {target_square}, and you lose material.",
    "fork": "allows the opponent's {attacker_piece} on {attacker_square} to attack your "
    "{target_piece} on {target_square} and {second_piece} on {second_square} at the same time "
    "(a fork).",
    "skewer": "allows the opponent's {attacker_piece} on {attacker_square} to attack your "
    "{target_piece} on {target_square}, and the {second_piece} on {second_square} behind it "
    "will fall (a skewer).",
    "pin": "lets the opponent's {attacker_piece} on {attacker_square} pin your {target_piece} "
    "on {target_square} to your king.",
    "discovered": "allows a discovered attack: when the opponent moves a piece, their "
    "{attacker_piece} on {attacker_square} attacks your {target_piece} on {target_square}.",
    "discovered_check": "allows a discovered check: when the opponent moves a piece, their "
    "{attacker_piece} on {attacker_square} gives check.",
    "center": "lets the opponent play a pawn to {attacker_square} and take control of the center.",
    "king": "weakens the pawns in front of your king, and the opponent's {attacker_piece} can "
    "check it from {attacker_square}.",
    "reply": "lets the opponent's {attacker_piece} go to {attacker_square}, which gives them "
    "the better position.",
}


def both(text: str) -> dict[Level, str]:
    return {"beginner": text, "intermediate": text}


def motif_templates() -> dict[str, dict[Level, str]]:
    templates: dict[str, dict[Level, str]] = {}
    for kind, sentence in GOOD.items():
        templates[f"lesson_great_{kind}"] = both(
            f"Great move! {sentence} It was the only move that kept your advantage."
        )
        templates[f"lesson_brilliant_{kind}"] = both(
            f"A brilliant idea! You gave up material on purpose, and the follow-up checks "
            f"suggest it pays off. {sentence}"
        )
        if kind in MISS_KINDS:
            templates[f"lesson_miss_{kind}"] = both(f"This was a missed chance. {sentence}")
    templates["lesson_miss_forced_mate"] = both(
        "This was a missed chance: a forced checkmate was available, starting with your "
        "{attacker_piece} to {attacker_square}."
    )
    for label in ("mistake", "blunder"):
        for kind, clause in FLAW.items():
            templates[f"lesson_{label}_{kind}"] = both(
                f"This move is a {label} because it {clause}"
            )
    return templates
