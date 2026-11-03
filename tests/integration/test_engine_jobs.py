import asyncio
import os
from pathlib import Path

import chess
import pytest

from services.adapters.stockfish import open_engine
from services.core.analysis.runner import AnalysisCancelled
from services.worker.analysis import execute
from tests.integration.analysis_fixtures import analysis_fixture


@pytest.mark.integration
@pytest.mark.parametrize("mode", ["quick", "deep"])
def test_pinned_engine_completes_durable_job_with_legal_white_pov_lines(mode):
    with analysis_fixture(mode) as (store, queued):
        execute(str(queued.id), str(queued.token))
        job, evidence = store.get(queued.id), store.evidence(queued.id)
        assert job.state == "completed", job.error_code
        assert job.completed_plies == job.total_plies == 4
        assert len(evidence) == 4
        for review in evidence:
            assert review.played.score.pov == "white"
            assert review.played.mover_score.pov == review.mover
            assert review.played.wdl is not None
            assert review.played.pv[0].uci == review.played_uci
            for line in (*review.best, review.played):
                board = chess.Board(review.root_fen)
                for step in line.pv:
                    assert board.parse_san(step.san).uci() == step.uci
                    board.push_uci(step.uci)
                    assert board.fen() == step.fen


@pytest.mark.integration
def test_cancelling_inflight_search_stops_and_reaps_engine():
    async def scenario():
        started, cancel = asyncio.Event(), False

        async def checkpoint():
            started.set()
            if cancel:
                raise AnalysisCancelled()

        async with open_engine(Path("bin/stockfish")) as engine:
            pid = engine.protocol.transport.get_pid()
            task = asyncio.create_task(engine.search(chess.Board(), 0.75, 3, None, checkpoint))
            await asyncio.wait_for(started.wait(), 5)
            cancel = True
            with pytest.raises(AnalysisCancelled):
                await asyncio.wait_for(task, 5)
        with pytest.raises(ProcessLookupError):
            os.kill(pid, 0)

    asyncio.run(scenario())


@pytest.mark.integration
def test_pinned_engine_keeps_repetition_history_and_distinguishes_claimable_draw():
    pgn = '[Result "1/2-1/2"]\n\n1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 1/2-1/2\n'
    with analysis_fixture(pgn=pgn, white_result="agreed", black_result="agreed") as (store, queued):
        execute(str(queued.id), str(queued.token))
        job, evidence = store.snapshot(queued.id)
        assert job.state == "completed", job.error_code
        assert evidence[-1].claimable_draw_before
        assert evidence[-1].automatic_result_after is None
        assert evidence[-1].before_ply == 7
