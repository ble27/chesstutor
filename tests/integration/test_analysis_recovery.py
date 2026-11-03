import asyncio
from datetime import timedelta

import pytest

from services.core.analysis.runner import AnalysisCancelled, analyse_game
from tests.integration.analysis_fixtures import analysis_fixture
from tests.unit.test_analysis_runner import FakeEngine


def sample_evidence(job):
    result = []

    async def publish(value):
        result.append(value)

    async def checkpoint():
        pass

    asyncio.run(
        analyse_game(
            job.game_data.initial_fen,
            tuple(position.uci for position in job.game_data.positions[1:]),
            job.mode,
            FakeEngine(),
            publish,
            checkpoint,
        )
    )
    return result


@pytest.mark.integration
def test_crash_recovers_once_and_fences_old_writes_without_losing_partial_evidence():
    with analysis_fixture() as (store, queued):
        now = queued.created_at
        running = store.claim(queued.id, queued.token, now)
        assert running.attempts == 1 and running.state == "running"
        values = sample_evidence(running)
        store.save_ply(running.id, running.token, values[0], now)
        store.recover(now + timedelta(seconds=31))
        recovered = store.get(queued.id)
        assert recovered.state == "queued" and recovered.token != running.token
        assert recovered.completed_plies == 1
        with pytest.raises(AnalysisCancelled):
            store.save_ply(running.id, running.token, values[1], now + timedelta(seconds=32))
        second = store.claim(recovered.id, recovered.token, now + timedelta(seconds=32))
        assert second.attempts == 2
        assert second.deadline_at == running.deadline_at
        store.recover(now + timedelta(seconds=63))
        failed = store.get(queued.id)
        assert failed.state == "failed" and failed.error_code == "worker_crashed"
        assert len(store.evidence(failed.id)) == 1


@pytest.mark.integration
def test_cancellation_wins_completion_race_and_timeout_stays_partial():
    with analysis_fixture() as (store, queued):
        running = store.claim(queued.id, queued.token, queued.created_at)
        store.cancel(running.id, running.owner, queued.created_at)
        store.finish(running.id, running.token, "completed", None, queued.created_at)
        assert store.get(running.id).state == "cancelled"
    with analysis_fixture() as (store, queued):
        running = store.claim(queued.id, queued.token, queued.created_at)
        store.recover(queued.created_at + timedelta(seconds=91))
        failed = store.get(running.id)
        assert failed.state == "failed" and failed.error_code == "timeout"
        assert failed.completed_plies == 0


@pytest.mark.integration
def test_response_snapshot_keeps_evidence_and_progress_at_one_database_snapshot():
    with analysis_fixture() as (store, queued):
        store.claim(queued.id, queued.token, queued.created_at)
        value = sample_evidence(queued)[0]
        store.save_ply(queued.id, queued.token, value, queued.created_at)
        job, evidence = store.snapshot(queued.id)
        assert job.completed_plies == len(evidence) == 1
        assert evidence[0].ply == 1
