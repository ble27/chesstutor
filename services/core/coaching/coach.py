"""Grounded coach: validate context, gate the question, answer from reviewed templates."""

import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass

import chess

from services.core.coaching.facts import color_of, evidence_block, is_opportunity
from services.core.coaching.requests import (
    MAX_QUESTION_CHARS,
    Model,
    ask_model,
    in_domain,
    keyword_intent,
    rule_template,
)
from services.core.coaching.templates import block
from services.core.coaching.values import (
    INTENTS,
    LEVELS,
    CoachingResult,
    EvidenceRecord,
    Intent,
    Level,
    PracticeTheme,
    TemplateBlock,
)

THEMES = {"hanging_piece": "loose_pieces", "fork": "forks", "pin": "pins"}
IMPROVE = {"hanging_piece": "improve_loose_pieces", "fork": "improve_forks", "pin": "improve_pins"}


@dataclass(frozen=True)
class Context:
    fen: str
    ply: int
    player: chess.Color
    color_name: str
    level: Level
    complete: bool
    question: str


def refusal(color: str) -> CoachingResult:
    return CoachingResult("refused", color, (block("refusal", ()),))


def uncertain(ctx: Context, scope: str = "position") -> CoachingResult:
    notice = block("uncertain_deep", ())
    return CoachingResult("uncertain", ctx.color_name, (notice,), suggest_deep=True, scope=scope)


def validate(*, game_exists: bool, analysis_exists: bool, total_plies: int, ply: int, fen: str,
             color: str, level: str, question: str | None) -> Level:  # fmt: skip
    if not game_exists or not analysis_exists:
        raise ValueError("A game and its analysis must exist")
    if not 0 <= ply <= total_plies:
        raise ValueError("Ply is outside the game")
    if color not in ("white", "black") or level not in LEVELS:
        raise ValueError("Unsupported color or level")
    if question is not None and len(question) > MAX_QUESTION_CHARS:
        raise ValueError("Question is too long")
    if not chess.Board(fen).is_valid():
        raise ValueError("Invalid position")
    return next(item for item in LEVELS if item == level)


def usable(items: Sequence[EvidenceRecord], ctx: Context, bound: bool) -> list[EvidenceRecord]:
    """Keep evidence that is legal, supported, and (when `bound`) for this exact position."""
    kept: list[EvidenceRecord] = []
    for item in items:
        if bound and (item.ply != ctx.ply or item.fen != ctx.fen):
            continue
        try:
            evidence_block(item, ctx.player, ctx.level)
        except ValueError, IndexError, KeyError:
            continue
        kept.append(item)
    return kept


def explain(ctx: Context, items: list[EvidenceRecord]) -> CoachingResult:
    if not items:
        return uncertain(ctx)
    blocks = tuple(evidence_block(item, ctx.player, ctx.level) for item in items)
    return CoachingResult("grounded", ctx.color_name, blocks, tuple(item.id for item in items))


def threats(ctx: Context, items: list[EvidenceRecord]) -> CoachingResult:
    dangers = [item for item in items if not is_opportunity(item, ctx.player)]
    if not dangers:
        return CoachingResult(
            "uncertain", ctx.color_name, (block("no_threat", ()),), suggest_deep=True
        )
    return explain(ctx, dangers)


def better(ctx: Context, items: list[EvidenceRecord]) -> CoachingResult:
    for item in items:
        if item.continuation_uci and item.kind in IMPROVE and is_opportunity(item, ctx.player):
            shown = evidence_block(item, ctx.player, ctx.level)
            idea = TemplateBlock(f"better_{item.kind}", shown.evidence_ids, shown.values)
            return CoachingResult(
                "grounded", ctx.color_name, (idea,), (item.id,), tuple(item.continuation_uci)
            )
    return uncertain(ctx)


def rule(ctx: Context) -> CoachingResult:
    return CoachingResult(
        "grounded", ctx.color_name, (block(rule_template(ctx.question), (), level=ctx.level),),
        scope="rules",
    )  # fmt: skip


def improvement(ctx: Context, items: list[EvidenceRecord]) -> CoachingResult:
    if not ctx.complete:
        return uncertain(ctx, "partial_game")
    if not items:
        return uncertain(ctx, "this_game")
    blocks = tuple(
        block(IMPROVE[item.kind], (item.id,), level=ctx.level, move_number=str((item.ply + 1) // 2))
        for item in items
    )
    plies = tuple(sorted({item.ply for item in items}))
    themes = tuple(
        PracticeTheme(theme, tuple(sorted(i.ply for i in items if THEMES[i.kind] == theme)))
        for theme in dict.fromkeys(THEMES[item.kind] for item in items)
    )
    ids = tuple(item.id for item in items)
    return CoachingResult(
        "grounded", ctx.color_name, blocks, ids, (), False, plies, "this_game", themes
    )


def answer(intent: Intent, ctx: Context, items: list[EvidenceRecord]) -> CoachingResult:
    if intent == "explain_chess_rule":
        return rule(ctx)
    if intent == "game_improvement":
        return improvement(ctx, items)
    handlers: dict[str, Callable[[Context, list[EvidenceRecord]], CoachingResult]] = {
        "explain_move": explain,
        "position_plan": explain,
        "better_move": better,
        "opponent_threat": threats,
    }
    return handlers[intent](ctx, items)


def choose_intent(
    intent: str | None, question: str, items: list[EvidenceRecord], model: Model | None,
    clock: Callable[[], float],
) -> tuple[Intent | None, list[EvidenceRecord]]:  # fmt: skip
    """Pick the intent and evidence subset; a model may help but never overrides gates."""
    known = frozenset(item.id for item in items)
    choice = ask_model(model, question, known, clock) if model and question else None
    if choice and choice.evidence_ids:
        items = [item for item in items if item.id in choice.evidence_ids]
    if intent in INTENTS:
        return intent, items  # type: ignore[return-value]
    if intent is not None or not question:
        return None, items
    return (choice.intent if choice else keyword_intent(question)), items


def coach(
    *,
    game_id: str,
    analysis_id: str,
    game_exists: bool,
    analysis_exists: bool,
    total_plies: int,
    ply: int,
    fen: str,
    player_color: str,
    level: str,
    intent: str | None,
    question: str | None = None,
    evidence: Sequence[EvidenceRecord] = (),
    analysis_state: str = "completed",
    model: Model | None = None,
    username: str = "",
    pgn_metadata: str = "",
    pgn_comments: str = "",
    clock: Callable[[], float] | None = None,
) -> CoachingResult:
    """Answer one supported chess question from validated evidence, or refuse/qualify."""
    del game_id, analysis_id, username, pgn_metadata, pgn_comments  # untrusted: never policy
    chosen_level = validate(
        game_exists=game_exists, analysis_exists=analysis_exists, total_plies=total_plies,
        ply=ply, fen=fen, color=player_color, level=level, question=question,
    )  # fmt: skip
    text = (question or "").strip()
    if text and not in_domain(text):
        return refusal(player_color)
    complete = analysis_state == "completed"
    ctx = Context(fen, ply, color_of(player_color), player_color, chosen_level, complete, text)
    bound = intent != "game_improvement"
    items = usable(evidence, ctx, bound)
    chosen, items = choose_intent(intent, text, items, model, clock or time.monotonic)
    return refusal(player_color) if chosen is None else answer(chosen, ctx, items)
