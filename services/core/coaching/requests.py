"""Question gating, intent choice, and bounded validation of optional model output.

The structural boundary is code, not prompt text: a question must be chess-only,
and the model may only return an approved intent plus known evidence IDs.
"""

import json
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from services.core.coaching.values import INTENTS, Intent

MAX_QUESTION_CHARS = 1000
MODEL_DEADLINE_SECONDS = 10
MODEL_MAX_TOKENS = 256
MAX_MODEL_CALLS = 2
CHESS_WORDS = frozenset(
    [
        "move",
        "moves",
        "piece",
        "pieces",
        "queen",
        "king",
        "rook",
        "bishop",
        "knight",
        "pawn",
        "pawns",
        "castle",
        "castling",
        "check",
        "checkmate",
        "mate",
        "position",
        "plan",
        "hanging",
        "fork",
        "pin",
        "pinned",
        "skewer",
        "threat",
        "threatening",
        "opponent",
        "better",
        "alternative",
        "improve",
        "game",
        "rule",
        "rules",
        "square",
        "board",
        "endgame",
        "opening",
        "stalemate",
        "promotion",
        "capture",
    ]
)
BLOCKED_WORDS = frozenset(
    [
        "ignore",
        "password",
        "secret",
        "script",
        "execute",
        "hack",
        "recipe",
        "stock",
        "stocks",
        "private",
        "chat",
        "messages",
        "payload",
        "prompt",
        "system",
    ]
)
CLAUSE_BREAK = re.compile(r"[.;!?,]| and | then | but ")
Model = Callable[..., object]


@dataclass(frozen=True)
class ModelChoice:
    intent: Intent
    evidence_ids: tuple[str, ...]


def words(text: str) -> set[str]:
    return set(re.findall(r"[a-z']+", text.lower()))


def in_domain(question: str) -> bool:
    """True only when every clause is about chess and nothing is blocked."""
    if words(question) & BLOCKED_WORDS:
        return False
    clauses = [part for part in CLAUSE_BREAK.split(question.lower()) if part.strip()]
    return bool(clauses) and all(words(clause) & CHESS_WORDS for clause in clauses)


def keyword_intent(question: str) -> Intent:
    """Deterministic fallback when no model chooses an intent."""
    found = words(question)
    if found & {"improve", "practice", "overall", "study"}:
        return "game_improvement"
    if found & {"rule", "rules", "castling", "castle", "stalemate", "promotion", "passant"}:
        return "explain_chess_rule"
    if found & {"threat", "threatening", "attacking"}:
        return "opponent_threat"
    if found & {"better", "alternative", "instead"}:
        return "better_move"
    if found & {"plan", "strategy"}:
        return "position_plan"
    return "explain_move"


def rule_template(question: str) -> str:
    found = words(question)
    for key, template in (
        ("castling", "rule_castling"),
        ("castle", "rule_castling"),
        ("passant", "rule_en_passant"),
        ("promotion", "rule_promotion"),
        ("check", "rule_check"),
        ("stalemate", "rule_stalemate"),
    ):
        if key in found:
            return template
    return "rule_general"


def validated_choice(raw: object, known_ids: frozenset[str]) -> ModelChoice | None:
    """Accept only the exact schema, an approved intent, and evidence IDs we supplied."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return None
    if not isinstance(raw, Mapping) or set(raw) != {"intent", "evidence_ids"}:
        return None
    intent, ids = raw["intent"], raw["evidence_ids"]
    if intent not in INTENTS or not isinstance(ids, list):
        return None
    if not all(isinstance(item, str) and item in known_ids for item in ids):
        return None
    return ModelChoice(intent, tuple(ids))


def ask_model(
    model: Model, question: str, known_ids: frozenset[str], clock: Callable[[], float]
) -> ModelChoice | None:
    """At most two calls inside one ten-second deadline; any failure means no choice."""
    started = clock()
    for attempt in range(MAX_MODEL_CALLS):
        remaining = MODEL_DEADLINE_SECONDS - (clock() - started)
        if remaining <= 0:
            return None
        timeout = MODEL_DEADLINE_SECONDS if attempt == 0 else remaining
        try:
            raw = model(question, timeout_seconds=timeout, max_tokens=MODEL_MAX_TOKENS)
        except Exception:  # noqa: BLE001 - external model failures must never reach callers
            raw = None
        choice = validated_choice(raw, known_ids)
        if choice is not None:
            return choice
    return None
