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
            await asyncio.gather(handshake, return_exceptions=True)
            raise
        pending = asyncio.create_task(result.wait())
        try:
            await wait_checkpoint(pending, checkpoint)
            await checkpoint()
            if not result.multipv:
                raise ValueError("Engine returned no lines")
            return tuple(normalise_line(board, info) for info in result.multipv)
        finally:
            if not pending.done():
                result.stop()
                try:
                    await asyncio.wait_for(asyncio.shield(pending), timeout=1)
                except TimeoutError:
                    pending.cancel()
                    # The owning context closes/kills the process before propagating failure.


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
