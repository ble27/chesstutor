import asyncio

import chess
import chess.engine
import pytest

from services.adapters.stockfish import UciEngine


class Analysis:
    """Streams raw UCI info messages in arrival order, like python-chess."""

    def __init__(self, messages):
        self.messages = messages
        self.stopped = False

    def __aiter__(self):
        return self.stream()

    async def stream(self):
        for message in self.messages:
            yield message

    def stop(self):
        self.stopped = True


class Protocol:
    def __init__(self, infos):
        self.result = Analysis(infos)
        self.request = None

    async def analysis(self, board, limit, **options):
        self.request = (board.copy(), limit, options)
        return self.result


def info(board, **updates):
    return {
        "score": chess.engine.PovScore(chess.engine.Mate(3), board.turn),
        "wdl": chess.engine.PovWdl(chess.engine.Wdl(700, 200, 100), board.turn),
        "pv": [next(iter(board.legal_moves))],
        "depth": 8,
        "nodes": 200,
        "time": 0.1,
        **updates,
    }


async def checkpoint():
    pass


def test_black_mate_and_wdl_remain_separate_from_centipawns():
    board = chess.Board()
    board.push_uci("e2e4")
    protocol = Protocol([info(board)])
    (line,) = asyncio.run(UciEngine(protocol).search(board, 0.1, 2, None, checkpoint))
    assert line.score.kind == "mate" and line.score.moves == -3
    assert line.mover_score.moves == 3
    assert line.score.pov == "white" and line.wdl.pov == "black"
    assert (line.wdl.wins, line.wdl.draws, line.wdl.losses) == (700, 200, 100)
    assert line.pv[0].san == board.san(next(iter(board.legal_moves)))
    assert protocol.request[1].time == 0.1
    assert protocol.request[2]["multipv"] == 2


@pytest.mark.parametrize(
    "updates", [{"pv": []}, {"pv": [chess.Move.from_uci("a1a8")]}, {"score": None}, {"depth": 0}]
)
def test_invalid_or_incomplete_output_is_never_returned(updates):
    board = chess.Board()
    with pytest.raises(ValueError):
        asyncio.run(
            UciEngine(Protocol([info(board, **updates)])).search(board, 0.1, 2, None, checkpoint)
        )


def test_missing_wdl_is_preserved_as_missing_evidence():
    board = chess.Board()
    raw = info(board)
    del raw["wdl"]
    (line,) = asyncio.run(UciEngine(Protocol([raw])).search(board, 0.1, 2, None, checkpoint))
    assert line.wdl is None


def search(board, messages, multipv=1):
    protocol = Protocol(messages)
    return asyncio.run(UciEngine(protocol).search(board, 0.1, multipv, None, checkpoint))


def test_a_trailing_bound_does_not_replace_the_last_completed_iteration():
    # Stockfish 19 can be stopped inside an aspiration-window re-search and
    # leave a bound score as its final message.
    board = chess.Board()
    exact = info(board, score=chess.engine.PovScore(chess.engine.Cp(30), board.turn), depth=14)
    bound = info(
        board,
        score=chess.engine.PovScore(chess.engine.Cp(55), board.turn),
        depth=15,
        lowerbound=True,
    )
    (line,) = search(board, [exact, bound])
    assert line.bounded is False
    assert (line.mover_score.centipawns, line.depth) == (30, 14)


def test_an_early_bound_flag_does_not_taint_later_exact_scores():
    board = chess.Board()
    early = info(
        board, score=chess.engine.PovScore(chess.engine.Cp(10), board.turn), upperbound=True
    )
    later = info(board, score=chess.engine.PovScore(chess.engine.Cp(40), board.turn), depth=12)
    (line,) = search(board, [early, later])
    assert line.bounded is False
    assert (line.mover_score.centipawns, line.depth) == (40, 12)


def test_a_line_with_only_bound_scores_stays_marked_bounded():
    board = chess.Board()
    (line,) = search(board, [info(board, lowerbound=True)])
    assert line.bounded is True


def test_each_multipv_line_keeps_its_own_last_exact_message():
    board = chess.Board()

    def cp(value):
        return chess.engine.PovScore(chess.engine.Cp(value), board.turn)

    moves = list(board.legal_moves)
    messages = [
        info(board, multipv=1, score=cp(50), depth=13, pv=[moves[0]]),
        info(board, multipv=2, score=cp(20), depth=13, pv=[moves[1]]),
        info(board, multipv=1, score=cp(60), depth=14, pv=[moves[0]], lowerbound=True),
    ]
    first, second = search(board, messages, multipv=2)
    assert (first.mover_score.centipawns, first.depth, first.bounded) == (50, 13, False)
    assert (second.mover_score.centipawns, second.depth, second.bounded) == (20, 13, False)


def test_a_missing_best_line_cannot_promote_the_second_line():
    board = chess.Board()
    with pytest.raises(ValueError, match="incomplete MultiPV"):
        search(board, [info(board, multipv=2)], multipv=2)


def test_messages_without_a_score_or_variation_are_ignored():
    board = chess.Board()
    noise = [{"currmove": next(iter(board.legal_moves)), "currmovenumber": 1}, {"string": "x"}]
    (line,) = search(board, [*noise, info(board, depth=9)])
    assert line.depth == 9 and line.bounded is False


def test_variation_ends_at_automatic_draw_instead_of_failing_the_job():
    board = chess.Board("7k/8/8/8/8/8/2n5/1B5K w - - 0 1")
    raw = info(board, pv=[chess.Move.from_uci("b1c2"), chess.Move.from_uci("h8g8")])
    (line,) = asyncio.run(UciEngine(Protocol([raw])).search(board, 0.1, 1, None, checkpoint))
    assert [step.san for step in line.pv] == ["Bxc2"]
    assert chess.Board(line.pv[-1].fen).is_insufficient_material()


def test_deadline_checkpoint_interrupts_a_hung_analysis_handshake():
    class HungProtocol:
        async def analysis(self, *args, **kwargs):
            await asyncio.Event().wait()

    async def scenario():
        calls = 0

        async def deadline():
            nonlocal calls
            calls += 1
            if calls >= 2:
                raise TimeoutError("fixture deadline reached")

        with pytest.raises(TimeoutError, match="fixture deadline reached"):
            await asyncio.wait_for(
                UciEngine(HungProtocol()).search(chess.Board(), 0.1, 2, None, deadline), timeout=1
            )

    asyncio.run(scenario())


def test_unresponsive_handshake_cleanup_kills_and_reaps_instead_of_waiting_forever():
    async def scenario():
        stopped = asyncio.Event()
        reaped = asyncio.get_running_loop().create_future()

        class Transport:
            killed = False

            def get_returncode(self):
                return -9 if self.killed else None

            def kill(self):
                self.killed = True
                reaped.set_result(-9)
                stopped.set()

        class StubbornProtocol:
            transport = Transport()
            returncode = reaped

            async def analysis(self, *args, **kwargs):
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    await stopped.wait()

        protocol = StubbornProtocol()
        calls = 0

        async def deadline():
            nonlocal calls
            calls += 1
            if calls >= 3:
                raise TimeoutError("fixture deadline")

        task = asyncio.create_task(
            UciEngine(protocol).search(chess.Board(), 0.1, 1, None, deadline)
        )
        try:
            done, _ = await asyncio.wait({task}, timeout=2)
            assert done, "Engine cancellation cleanup was not bounded"
            with pytest.raises(chess.engine.EngineError, match="forced termination"):
                await task
            assert protocol.transport.killed
            assert reaped.done()
        finally:
            stopped.set()
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(scenario())
