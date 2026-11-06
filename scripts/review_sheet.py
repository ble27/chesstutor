"""Pure helpers for the human coaching review sheet (plan.md S5 gate).

This is tooling, not product code: it picks a balanced set of positions, checks each
lesson mechanically, and renders Markdown for a chess-literate reviewer. A human
decides whether the guidance is correct and actionable; nothing here grades chess.
"""

import re
from collections import defaultdict
from dataclasses import dataclass

import chess

from services.core.analysis.values import MoveEvidence
from services.core.classification.review import ReviewedMove
from services.core.coaching.lessons import Lesson, lesson_kind
from services.core.coaching.templates import render_blocks

KIND_ORDER = ("blunder", "mistake", "miss", "great", "brilliant")
CONTROL_ORDER = ("inaccuracy", "good", "best")
NOTATION = re.compile(r"\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8]\b|\b[a-h]x[a-h][1-8]\b|O-O")


@dataclass(frozen=True)
class SheetEntry:
    game: str
    review: ReviewedMove
    evidence: MoveEvidence
    lesson: Lesson | None


@dataclass(frozen=True)
class Selection:
    entries: tuple[SheetEntry, ...]
    lessons: int
    controls: int
    short: bool


def spread(items: list[SheetEntry], count: int) -> list[SheetEntry]:
    """`count` evenly spaced items, so picks are not clustered at the start of a game."""
    ordered = sorted(items, key=lambda entry: (entry.game, entry.review.ply))
    return [ordered[index * len(ordered) // count] for index in range(count)] if count else []


def round_robin_quotas(sizes: dict[str, int], target: int) -> dict[str, int]:
    quotas = dict.fromkeys(sizes, 0)
    while sum(quotas.values()) < target and any(quotas[key] < sizes[key] for key in sizes):
        for key in sizes:
            if quotas[key] < sizes[key] and sum(quotas.values()) < target:
                quotas[key] += 1
    return quotas


def pick(groups: dict[str, list[SheetEntry]], target: int) -> list[SheetEntry]:
    quotas = round_robin_quotas({key: len(items) for key, items in groups.items()}, target)
    return [entry for key, items in groups.items() for entry in spread(items, quotas[key])]


def lesson_groups(entries: list[SheetEntry]) -> dict[str, list[SheetEntry]]:
    groups: dict[str, list[SheetEntry]] = defaultdict(list)
    for entry in entries:
        if entry.lesson is not None:
            groups[f"{entry.lesson.kind}/{entry.review.mover}"].append(entry)
    order = {kind: index for index, kind in enumerate(KIND_ORDER)}
    return dict(sorted(groups.items(), key=lambda item: (order[item[0].split("/")[0]], item[0])))


def control_groups(entries: list[SheetEntry]) -> dict[str, list[SheetEntry]]:
    groups: dict[str, list[SheetEntry]] = {label: [] for label in CONTROL_ORDER}
    for entry in entries:
        routine = entry.lesson is None and lesson_kind(entry.review) is None
        if routine and entry.review.label in groups:
            groups[entry.review.label].append(entry)
    return {label: items for label, items in groups.items() if items}


def select_entries(entries: list[SheetEntry], lesson_target: int, control_target: int) -> Selection:
    lessons = pick(lesson_groups(entries), lesson_target)
    controls = pick(control_groups(entries), control_target)
    chosen = sorted(lessons + controls, key=lambda entry: (entry.game, entry.review.ply))
    return Selection(tuple(chosen), len(lessons), len(controls), len(lessons) < lesson_target)


def is_legal(root: chess.Board, uci: str) -> bool:
    try:
        return chess.Move.from_uci(uci) in root.legal_moves
    except ValueError:
        return False


def lesson_problems(entry: SheetEntry, lesson: Lesson) -> list[str]:
    problems: list[str] = []
    kind = lesson_kind(entry.review)
    if kind is None:
        problems.append("lesson shown for a routine ply")
    elif lesson.kind != kind:
        problems.append(f"lesson kind {lesson.kind} differs from the stored label")
    root = chess.Board(entry.evidence.root_fen)
    problems += [f"illegal arrow {a.uci}" for a in lesson.arrows if not is_legal(root, a.uci)]
    problems += [
        f"illegal alternative {a.uci}" for a in lesson.alternatives if not is_legal(root, a.uci)
    ]
    texts = [render_blocks(lesson.blocks), *(a.description for a in lesson.alternatives)]
    problems += [f"notation in learner text: {t}" for t in texts if NOTATION.search(t)]
    if len(lesson.alternatives) > 2 or sum(a.kind == "suggested" for a in lesson.arrows) > 2:
        problems.append("more than two suggestions")
    return problems


def self_check(entry: SheetEntry) -> tuple[str, ...]:
    """Mechanical problems only; whether the advice is good chess is for the human."""
    if entry.lesson is None:
        flagged = lesson_kind(entry.review) is not None
        return ("flagged ply has no lesson",) if flagged else ()
    return tuple(lesson_problems(entry, entry.lesson))


def san(root_fen: str, uci: str) -> str:
    board = chess.Board(root_fen)
    return board.san(chess.Move.from_uci(uci)) if is_legal(board, uci) else f"{uci} (illegal)"


def entry_heading(number: int, entry: SheetEntry) -> str:
    review = entry.review
    shown = entry.lesson.kind.capitalize() if entry.lesson else f"Routine ({review.label})"
    return f"### {number} · {entry.game} ply {review.ply} · {review.mover.capitalize()} · {shown}"


def render_facts(entry: SheetEntry) -> list[str]:
    review, evidence = entry.review, entry.evidence
    best = evidence.best[0].pv[0].uci if evidence.best and evidence.best[0].pv else None
    loss = "unknown" if review.expected_loss is None else f"{review.expected_loss:.0%}"
    return [
        f"- Position before the move (FEN): `{evidence.root_fen}`",
        f"- Played: **{san(evidence.root_fen, evidence.played_uci)}**; engine's first choice: "
        f"**{san(evidence.root_fen, best) if best else 'none'}**",
        f"- Stored label: {review.label}; expected-score loss {loss}; badges: "
        f"{', '.join(review.badges) or 'none'}",
    ]


def render_lesson_lines(entry: SheetEntry) -> list[str]:
    lesson = entry.lesson
    if lesson is None:
        return ["- **No note shown** (routine move). The learner sees nothing for this move."]
    lines = [f"- **Coach note:** {render_blocks(lesson.blocks)}"]
    for item in lesson.alternatives:
        move = san(entry.evidence.root_fen, item.uci)
        lines.append(f"- Suggestion {item.rank} (reviewer notation {move}): {item.description}")
    return lines


def render_entry(number: int, entry: SheetEntry, image: str) -> str:
    problems = self_check(entry)
    checks = "pass" if not problems else "ISSUES: " + "; ".join(problems)
    first, second = (
        ("Correct and actionable (Y/N)", "Illegal or confidently false claim (Y/N)")
        if entry.lesson
        else ("Silence appropriate (Y/N)", "Missed an obvious problem (Y/N)")
    )
    return "\n".join(
        [
            entry_heading(number, entry),
            f"![Position before the move, arrows as the learner sees them]({image})",
            *render_facts(entry),
            *render_lesson_lines(entry),
            f"- Script checks: {checks}",
            "",
            f"| {first} | {second} | Comments |",
            "| --- | --- | --- |",
            "|  |  |  |",
            "",
        ]
    )


def render_header(selection: Selection, engine: str, mode: str, seed: int) -> list[str]:
    passed = sum(not self_check(entry) for entry in selection.entries)
    warning = (
        [
            f"> **SHORT:** only {selection.lessons} annotated positions were found. The gate "
            "needs at least 30. Generate more games before relying on this sheet.",
            "",
        ]
        if selection.short
        else []
    )
    return [
        "# S5 human coaching review sheet",
        "",
        "Gate (plan.md S5, PRD section 7): human review of at least 30 positions, "
        "at least 90% correct and actionable (27 of 30), and zero illegal moves or "
        "confidently false tactical claims. Control rows check that quiet moves stay quiet.",
        "",
        *warning,
        f"Provenance: {engine}, {mode} preset, one thread, seed {seed}. "
        f"{selection.lessons} annotated + {selection.controls} control positions. "
        f"Script checks (legality, notation, counts): {passed} of {len(selection.entries)} pass.",
        "",
        "How to review: read the board and the coach note. Mark *correct and actionable* "
        "only if a beginner would be told something true and useful. Mark the second column "
        "Y if any suggested move is illegal or any claim is false or overconfident. Notation "
        "appears here for you only; the learner sees plain words.",
        "",
        "Tally: annotated rows with Y in the first column divided by annotated rows must be "
        "at least 0.90, and the second column must contain no Y.",
        "",
    ]


def render_packet(selection: Selection, engine: str, mode: str, games: list[str], seed: int) -> str:
    parts = render_header(selection, engine, mode, seed)
    for number, entry in enumerate(selection.entries, start=1):
        parts.append(render_entry(number, entry, f"s5-review/{number:02d}.svg"))
    parts += ["## Games analysed (PGN movetext)", ""]
    parts += [f"{index}. G{index}: `{game}`" for index, game in enumerate(games, start=1)]
    return "\n".join(parts) + "\n"
