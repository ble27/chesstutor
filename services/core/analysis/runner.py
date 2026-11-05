from collections.abc import Awaitable, Callable
from fractions import Fraction
from time import monotonic
from typing import Protocol

import chess

from services.core.analysis.values import (
    PRESETS,
    Color,
    EngineLine,
    EvidenceStatus,
    Mode,
    MoveEvidence,
)

Checkpoint = Callable[[], Awaitable[None]]
Publish = Callable[[MoveEvidence], Awaitable[None]]


class AnalysisCancelled(Exception):
    pass


class Engine(Protocol):
    """Search boundary: cancellation must settle or terminate within one second."""

    async def search(
        self,
        board: chess.Board,
        seconds: float,
        multipv: int,
        root_moves: tuple[chess.Move, ...] | None,
        checkpoint: Checkpoint,
    ) -> tuple[EngineLine, ...]: ...


def evidence_status(best: EngineLine, played: EngineLine) -> tuple[EvidenceStatus, float | None]:
    if best.wdl is None or played.wdl is None or best.bounded or played.bounded:
        return "insufficient", None
    difference = best.wdl.expected() - played.wdl.expected()
    # Compare exact WDL ratios so the 0.02 boundary is not changed by float rounding.
    return (
        ("unstable", None)
        if difference < -Fraction(1, 50)
        else ("usable", float(max(Fraction(0), difference)))
    )


async def analyse_game(
    initial_fen: str,
    moves: tuple[str, ...],
    mode: Mode,
    engine: Engine,
    publish: Publish,
    checkpoint: Checkpoint,
    start_ply: int = 1,
    deadline: float | None = None,
    now: Callable[[], float] = monotonic,
) -> None:
    board, preset = chess.Board(initial_fen), PRESETS[mode]
    expires = deadline if deadline is not None else now() + preset.deadline_seconds

    async def bounded_checkpoint() -> None:
        await checkpoint()
        if now() >= expires:
            raise TimeoutError("Analysis deadline exceeded")

    for ply, uci in enumerate(moves, start=1):
        await bounded_checkpoint()
        move = chess.Move.from_uci(uci)
        if not board.is_valid() or move not in board.legal_moves or board.is_game_over():
            raise ValueError("Invalid canonical game history")
        if ply < start_ply:
            board.push(move)
            continue
        best = await engine.search(
            board, preset.search_seconds, preset.multipv, None, bounded_checkpoint
        )
        played = await engine.search(board, preset.search_seconds, 1, (move,), bounded_checkpoint)
        await bounded_checkpoint()
        if not best or not played or not played[0].pv or played[0].pv[0].uci != uci:
            raise ValueError("Engine did not analyse the played root move")
        status, loss = evidence_status(best[0], played[0])
        root, claimable = board.fen(), board.can_claim_draw()
        mover: Color = "white" if board.turn else "black"
        board.push(move)
        outcome = board.outcome(claim_draw=False)
        await publish(
            MoveEvidence(
                ply,
                ply - 1,
                root,
                mover,
                uci,
                best,
                played[0],
                status,
                loss,
                claimable,
                outcome.result() if outcome else None,
                outcome.termination.name.lower() if outcome else None,
            )
        )
