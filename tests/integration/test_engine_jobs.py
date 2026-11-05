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
        response = job.response(queued.owner, evidence)
        assert len(response.classifications) == 4
        assert response.summary is not None
        assert response.summary.is_final
        assert response.summary.coverage.analyzed_plies == 4
        for classification, move_evidence in zip(response.classifications, evidence, strict=True):
            assert classification.ply == move_evidence.ply
            assert classification.mover == move_evidence.mover
            assert classification.provisional is (mode == "quick")
            if move_evidence.status != "usable":
                assert classification.classification.base_label == "unclassified"
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


@pytest.mark.integration
def test_pinned_engine_verifies_missed_mate_without_exact_score_assumptions():
    from services.core.analysis.runner import evidence_status
    from services.core.analysis.values import MoveEvidence
    from services.core.classification.verification import verify_move

    async def scenario():
        board = chess.Board()
        for uci in ("f2f3", "e7e5", "g2g4"):
            board.push_uci(uci)

        async def checkpoint():
            pass

        # The funding boundary is exercised separately against PostgreSQL. This
        # fixture isolates the real engine's legal, qualitative tactical result.
        async def funded(cost_ms: int) -> bool:
            return cost_ms <= 3000

        async with open_engine(Path("bin/stockfish")) as engine:
            best = await engine.search(board, 0.75, 3, None, checkpoint)
            played = (await engine.search(board, 0.75, 1, (board.parse_uci("e8e7"),), checkpoint))[
                0
            ]
            status, loss = evidence_status(best[0], played)
            item = MoveEvidence(
                4, 3, board.fen(), "black", "e8e7", best, played, status, loss, False, None, None
            )
            review = await verify_move(
                board, item, "deep", engine, funded, checkpoint, deadline=10**12
            )
        assert review.classification.base_label in {"mistake", "blunder"}
        assert review.badges == ("miss",)
        assert review.proofs[0].motif == "forced_mate"
        final = chess.Board(review.proofs[0].line.pv[-1].fen)
        assert final.is_checkmate()
        assert final.turn == chess.WHITE

    asyncio.run(scenario())
