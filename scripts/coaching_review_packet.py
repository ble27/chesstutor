"""Generate the S5 human coaching review sheet from real Stockfish evidence.

Games come from a deliberately weakened Stockfish (Skill Level) after a seeded random
opening, so they contain human-like mistakes and misses. Each game is then analysed
with the production pipeline (`analyse_game`, `verify_move`) and lessons are built
with the production coach code. Output: a Markdown sheet and one SVG board per row.

    uv run python -m scripts.coaching_review_packet --games 6 --mode deep
"""

import argparse
import asyncio
import random
from dataclasses import dataclass
from pathlib import Path
from time import monotonic

import chess
import chess.engine
import chess.svg

from scripts.review_sheet import SheetEntry, render_packet, select_entries
from services.adapters.engine_binary import selected_artifact, verify_binary
from services.adapters.stockfish import open_engine
from services.core.analysis.runner import analyse_game
from services.core.analysis.values import Mode, MoveEvidence
from services.core.classification.review import ReviewedMove
from services.core.classification.verification import verify_move
from services.core.coaching.lessons import Lesson, build_lesson

ENGINE_PATH = Path("bin/stockfish")
PLAYED_COLOR, SUGGESTED_COLOR = "#b5483a", "#3f7f5f"


@dataclass(frozen=True)
class Options:
    games: int
    max_plies: int
    mode: Mode
    seed: int
    skill: int
    sheet: Path
    images: Path


async def play_game(index: int, options: Options) -> tuple[str, ...]:
    """A seeded random opening, then weakened-engine moves until the ply limit."""
    rng, board = random.Random(options.seed * 1000 + index), chess.Board()
    transport, engine = await chess.engine.popen_uci([str(ENGINE_PATH.resolve())])
    try:
        await engine.configure({"Skill Level": options.skill, "Threads": 1, "Hash": 16})
        while len(board.move_stack) < options.max_plies and not board.is_game_over():
            if len(board.move_stack) < 4:
                board.push(rng.choice(list(board.legal_moves)))
                continue
            result = await engine.play(board, chess.engine.Limit(time=0.04))
            if result.move is None:
                break
            board.push(result.move)
    finally:
        await engine.quit()
        transport.close()
    return tuple(move.uci() for move in board.move_stack)


async def reserve_all(cost_ms: int) -> bool:
    return True


async def no_checkpoint() -> None:
    return None


async def review_game(
    moves: tuple[str, ...], mode: Mode
) -> list[tuple[ReviewedMove, MoveEvidence]]:
    board, found = chess.Board(), []
    deadline = monotonic() + 3600
    async with open_engine(ENGINE_PATH) as engine:

        async def publish(evidence: MoveEvidence) -> None:
            review = await verify_move(
                board.copy(), evidence, mode, engine, reserve_all, no_checkpoint, deadline=deadline
            )
            found.append((review, evidence))
            board.push_uci(evidence.played_uci)

        await analyse_game(
            chess.STARTING_FEN, moves, mode, engine, publish, no_checkpoint, 1, deadline
        )
    return found


def sheet_entries(game: str, pairs: list[tuple[ReviewedMove, MoveEvidence]]) -> list[SheetEntry]:
    entries = []
    for review, evidence in pairs:
        lesson: Lesson | None = build_lesson(review, evidence, "beginner")
        entries.append(SheetEntry(game, review, evidence, lesson))
    return entries


def board_svg(entry: SheetEntry) -> str:
    board = chess.Board(entry.evidence.root_fen)
    arrows = []
    for arrow in entry.lesson.arrows if entry.lesson else ():
        color = PLAYED_COLOR if arrow.kind == "played" else SUGGESTED_COLOR
        arrows.append(
            chess.svg.Arrow(
                chess.parse_square(arrow.from_square),
                chess.parse_square(arrow.to_square),
                color=color,
            )
        )
    return chess.svg.board(board, arrows=arrows, orientation=board.turn, size=360)


def parse_options() -> Options:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else "")
    parser.add_argument("--games", type=int, default=6)
    parser.add_argument("--max-plies", type=int, default=50)
    parser.add_argument("--mode", choices=("quick", "deep"), default="deep")
    parser.add_argument("--seed", type=int, default=5)
    parser.add_argument("--skill", type=int, default=4)
    parser.add_argument("--sheet", type=Path, default=Path("docs/sprints/S5-review-sheet.md"))
    parser.add_argument("--images", type=Path, default=Path("docs/sprints/s5-review"))
    args = parser.parse_args()
    mode: Mode = "quick" if args.mode == "quick" else "deep"
    return Options(args.games, args.max_plies, mode, args.seed, args.skill, args.sheet, args.images)


async def collect(options: Options) -> tuple[list[SheetEntry], list[str]]:
    entries: list[SheetEntry] = []
    movetext: list[str] = []
    for index in range(1, options.games + 1):
        moves = await play_game(index, options)
        movetext.append(chess.Board().variation_san([chess.Move.from_uci(m) for m in moves]))
        entries += sheet_entries(f"G{index}", await review_game(moves, options.mode))
        print(f"game {index}/{options.games}: {len(moves)} plies analysed", flush=True)
    return entries, movetext


def write_outputs(options: Options, entries: list[SheetEntry], movetext: list[str]) -> None:
    selection = select_entries(entries, lesson_target=30, control_target=6)
    engine = (
        f"Stockfish {verify_binary(ENGINE_PATH, selected_artifact('darwin-arm64')).get('version')}"
    )
    options.images.mkdir(parents=True, exist_ok=True)
    for number, entry in enumerate(selection.entries, start=1):
        (options.images / f"{number:02d}.svg").write_text(board_svg(entry), encoding="utf-8")
    packet = render_packet(selection, engine, options.mode, movetext, options.seed)
    options.sheet.write_text(packet, encoding="utf-8")
    print(
        f"{selection.lessons} annotated + {selection.controls} control rows; "
        f"short={selection.short}"
    )


def main() -> None:
    options = parse_options()
    entries, movetext = asyncio.run(collect(options))
    write_outputs(options, entries, movetext)


if __name__ == "__main__":
    main()
