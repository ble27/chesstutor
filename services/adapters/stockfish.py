import asyncio
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import chess
import chess.engine

from services.adapters.stockfish_scores import normalise_line
from services.core.analysis.runner import Checkpoint
from services.core.analysis.values import EngineLine


async def wait_checkpoint[T](pending: asyncio.Task[T], checkpoint: Checkpoint) -> T:
    while not pending.done():
        await checkpoint()
        await asyncio.wait({pending}, timeout=0.05)
    return await pending


def completed_iteration(info: chess.engine.InfoDict) -> bool:
    """True for an exact score; a bound is sent while an iteration is still unresolved."""
    return not (info.get("lowerbound") or info.get("upperbound"))


async def collect_lines(result: chess.engine.AnalysisResult) -> list[chess.engine.InfoDict]:
    """Keep each line's last exact message, in MultiPV order.

    python-chess merges every message into one dictionary per line. A bound sent
    when Stockfish is stopped mid-iteration would overwrite the last exact score,
    and its flag would never clear. A line with no exact message keeps its latest
    bound so it stays marked as unusable evidence.
    """
    exact: dict[int, chess.engine.InfoDict] = {}
    bounded: dict[int, chess.engine.InfoDict] = {}
    async for info in result:
        if info.get("score") is None or not info.get("pv"):
            continue  # currmove, string, and other progress messages carry no evidence
        (exact if completed_iteration(info) else bounded)[info.get("multipv", 1)] = info
    latest = {**bounded, **exact}
    if sorted(latest) != list(range(1, len(latest) + 1)):
        raise ValueError("Engine returned incomplete MultiPV lines")
    return [latest[index] for index in sorted(latest)]


def consume_result(pending: asyncio.Future[object]) -> None:
    if not pending.cancelled():
        pending.exception()


async def settle_search(pending: asyncio.Task[object], protocol: chess.engine.UciProtocol) -> None:
    done, _ = await asyncio.wait({pending}, timeout=0.4)
    if done:
        consume_result(pending)
        return
    # asyncio.wait does not wait for cancellation handlers. If an engine does
    # not settle, kill it and bound reaping rather than awaiting a hung command.
    transport = protocol.transport
    if transport is not None and transport.get_returncode() is None:
        transport.kill()
    await asyncio.wait({protocol.returncode}, timeout=0.4)
    pending.cancel()
    pending.add_done_callback(consume_result)
    raise chess.engine.EngineError("Engine required forced termination during cleanup")


class UciEngine:
    def __init__(self, protocol: chess.engine.UciProtocol) -> None:
        self.protocol = protocol

    async def search(
        self,
        board: chess.Board,
        seconds: float,
        multipv: int,
        root_moves: tuple[chess.Move, ...] | None,
        checkpoint: Checkpoint,
    ) -> tuple[EngineLine, ...]:
        await checkpoint()
        handshake = asyncio.create_task(
            self.protocol.analysis(
                board,
                chess.engine.Limit(time=seconds),
                multipv=multipv,
                root_moves=root_moves,
            )
        )
        try:
            result = await wait_checkpoint(handshake, checkpoint)
        except BaseException:
            handshake.cancel()
            await settle_search(handshake, self.protocol)
            raise
        pending = asyncio.create_task(collect_lines(result))
        try:
            lines = await wait_checkpoint(pending, checkpoint)
            await checkpoint()
            if not lines:
                raise ValueError("Engine returned no lines")
            return tuple(normalise_line(board, info) for info in lines)
        finally:
            if not pending.done():
                result.stop()
                await settle_search(pending, self.protocol)


async def close_engine(
    transport: asyncio.SubprocessTransport,
    protocol: chess.engine.UciProtocol,
) -> None:
    try:
        await asyncio.wait_for(protocol.quit(), timeout=1)
    except TimeoutError, chess.engine.EngineError, BrokenPipeError:
        if transport.get_returncode() is None:
            transport.terminate()
    try:
        await asyncio.wait_for(asyncio.shield(protocol.returncode), timeout=1)
    except TimeoutError:
        transport.kill()
        await asyncio.wait_for(asyncio.shield(protocol.returncode), timeout=1)
    finally:
        transport.close()


@asynccontextmanager
async def open_engine(path: Path) -> AsyncIterator[UciEngine]:
    command = [sys.executable, "-m", "services.worker.engine_exec", str(path.resolve())]
    transport, protocol = await asyncio.wait_for(chess.engine.popen_uci(command), timeout=5)
    try:
        if not all(
            name in protocol.options for name in ("Threads", "Hash", "MultiPV", "UCI_ShowWDL")
        ):
            raise ValueError("Required engine capabilities are missing")
        await asyncio.wait_for(
            protocol.configure({"Threads": 1, "Hash": 128, "UCI_ShowWDL": True}), 5
        )
        yield UciEngine(protocol)
    finally:
        await asyncio.shield(close_engine(transport, protocol))
