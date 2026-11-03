import asyncio
from dataclasses import replace

import chess
import pytest

from services.core.analysis.runner import analyse_game
from services.core.analysis.values import CentipawnScore, EngineLine, VariationMove, Wdl


class FakeEngine:
    def __init__(self):
        self.calls = []

    async def search(self, board, seconds, multipv, root_moves, checkpoint):
        await checkpoint()
        self.calls.append((board.copy(), seconds, multipv, root_moves))
        move = root_moves[0] if root_moves else next(iter(board.legal_moves))
        following = board.copy()
        san = board.san(move)
        following.push(move)
        color = "white" if board.turn else "black"
        return (
            EngineLine(
                CentipawnScore(20 if board.turn else -20, "white"),
                CentipawnScore(20, color),
                Wdl(400, 300, 300, color),
                8,
                100,
                100,
                (VariationMove(move.uci(), san, following.fen()),),
            ),
        )


@pytest.mark.parametrize("mode,seconds,multipv", [("quick", 0.1, 2), ("deep", 0.75, 3)])
def test_same_root_budgets_history_and_mover_pov(mode, seconds, multipv):
    engine, evidence = FakeEngine(), []

    async def checkpoint():
        pass

    async def publish(value):
        evidence.append(value)

    asyncio.run(
        analyse_game(chess.STARTING_FEN, ("e2e4", "e7e5"), mode, engine, publish, checkpoint)
    )
    assert len(engine.calls) == 4
    assert [(call[1], call[2]) for call in engine.calls] == [
        (seconds, multipv),
        (seconds, 1),
        (seconds, multipv),
        (seconds, 1),
    ]
    assert engine.calls[0][0].fen() == engine.calls[1][0].fen()
    assert engine.calls[2][0].fen() == engine.calls[3][0].fen()
    assert len(engine.calls[2][0].move_stack) == 1
    assert engine.calls[1][3] == (chess.Move.from_uci("e2e4"),)
    assert evidence[0].mover == "white"
    assert evidence[1].mover == "black"
    assert evidence[1].played.score.centipawns == -20
    assert evidence[1].played.mover_score.centipawns == 20
    assert evidence[1].status == "usable"


def test_deadline_never_publishes_an_incomplete_comparison():
    engine, evidence = FakeEngine(), []
    time = [0.0]

    async def checkpoint():
        time[0] += 0.04

    async def publish(value):
        evidence.append(value)

    with pytest.raises(TimeoutError):
        asyncio.run(
            analyse_game(
                chess.STARTING_FEN,
                ("e2e4",),
                "quick",
                engine,
                publish,
                checkpoint,
                deadline=0.1,
                now=lambda: time[0],
            )
        )
    assert evidence == []


@pytest.mark.parametrize(
    "played_wins,status", [(520, "usable"), (521, "unstable"), (None, "insufficient")]
)
def test_wdl_instability_boundary_and_missing_evidence(played_wins, status):
    class ComparisonEngine(FakeEngine):
        async def search(self, board, seconds, multipv, root_moves, checkpoint):
            result = await super().search(board, seconds, multipv, root_moves, checkpoint)
            wins = played_wins if root_moves else 500
            wdl = None if wins is None else Wdl(wins, 0, 1000 - wins, "white")
            return (replace(result[0], wdl=wdl),)

    evidence = []

    async def publish(value):
        evidence.append(value)

    async def checkpoint():
        pass

    asyncio.run(
        analyse_game(
            chess.STARTING_FEN, ("e2e4",), "quick", ComparisonEngine(), publish, checkpoint
        )
    )
    assert evidence[0].status == status
    assert evidence[0].expected_loss == (0.0 if status == "usable" else None)
