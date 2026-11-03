import asyncio

import chess
import chess.engine
import pytest

from services.adapters.stockfish import UciEngine


class Analysis:
    def __init__(self, infos):
        self.multipv = infos
        self.stopped = False

    async def wait(self):
        return None

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
