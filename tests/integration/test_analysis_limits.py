from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import timedelta
from uuid import uuid4

import pytest

from services.core.analysis.values import AnalysisError
from tests.integration.analysis_fixtures import analysis_fixture
from tests.integration.test_analysis_recovery import sample_evidence


@pytest.mark.integration
@pytest.mark.parametrize("mode,limit", [("quick", 5), ("deep", 2)])
def test_sliding_session_quotas_and_retry_times(mode, limit):
    with analysis_fixture(mode) as (store, job):
        now, initial = job.created_at, job
        for index in range(limit):
            store.claim(job.id, job.token, now)
            store.finish(job.id, job.token, "failed", "fixture", now)
            if index < limit - 1:
                job, cached = store.submit(
                    job.game_id, mode, job.owner, job.ip_digest, job.engine, now, 100, True
                )
                assert not cached
        with pytest.raises(AnalysisError) as error:
            store.submit(job.game_id, mode, job.owner, job.ip_digest, job.engine, now, 100, True)
        assert error.value.code == "session_quota" and error.value.retry_after_seconds == 3600
        later, _ = store.submit(
            job.game_id,
            mode,
            job.owner,
            job.ip_digest,
            job.engine,
            now + timedelta(hours=1),
            100,
            True,
        )
        assert later.id != initial.id


@pytest.mark.integration
def test_completed_cache_is_free_cross_session_and_keeps_deep_label():
    with analysis_fixture("deep") as (store, job):
        store.claim(job.id, job.token, job.created_at)
        for evidence in sample_evidence(job):
            store.save_ply(job.id, job.token, evidence, job.created_at)
        store.finish(job.id, job.token, "completed", None, job.created_at)
        reused, cached = store.submit(
            job.game_id, "quick", uuid4().hex, job.ip_digest, job.engine, job.created_at, 1, False
        )
        assert cached and reused.id == job.id and reused.mode == "deep"


@pytest.mark.integration
@pytest.mark.parametrize(
    "field", ["analysis_version", "classification_version", "feature_version", "binary_sha256"]
)
def test_completed_cache_cannot_cross_engine_or_policy_versions(field):
    with analysis_fixture() as (store, job):
        store.claim(job.id, job.token, job.created_at)
        for evidence in sample_evidence(job):
            store.save_ply(job.id, job.token, evidence, job.created_at)
        store.finish(job.id, job.token, "completed", None, job.created_at)
        changed = {**job.engine, field: "changed-fixture-version"}
        new_job, cached = store.submit(
            job.game_id, "quick", uuid4().hex, uuid4().hex, changed, job.created_at, 100, True
        )
        assert not cached and new_job.id != job.id and new_job.state == "queued"


@pytest.mark.integration
def test_concurrent_duplicate_submissions_allocate_one_job():
    with analysis_fixture() as (store, initial):
        store.cancel(initial.id, initial.owner, initial.created_at)

        def submit(_index):
            return store.submit(
                initial.game_id,
                "quick",
                initial.owner,
                initial.ip_digest,
                initial.engine,
                initial.created_at,
                100,
                True,
            )[0]

        with ThreadPoolExecutor(max_workers=8) as executor:
            jobs = list(executor.map(submit, range(8)))
        assert len({job.id for job in jobs}) == 1
        assert jobs[0].id != initial.id


@pytest.mark.integration
def test_queue_capacity_and_shared_ip_limit_are_server_enforced():
    with analysis_fixture() as (store, initial):
        with pytest.raises(AnalysisError) as ip_error:
            store.submit(
                initial.game_id,
                "quick",
                uuid4().hex,
                initial.ip_digest,
                initial.engine,
                initial.created_at,
                1,
                True,
            )
        assert ip_error.value.code == "ip_quota"
        for _ in range(49):
            store.submit(
                initial.game_id,
                "quick",
                uuid4().hex,
                uuid4().hex,
                initial.engine,
                initial.created_at,
                100,
                True,
            )
        with pytest.raises(AnalysisError) as queue_error:
            store.submit(
                initial.game_id,
                "deep",
                uuid4().hex,
                uuid4().hex,
                initial.engine,
                initial.created_at,
                100,
                True,
            )
        assert queue_error.value.code == "queue_full"


@pytest.mark.integration
def test_two_running_jobs_limit_defers_without_spending_recovery_attempt():
    with ExitStack() as stack:
        jobs = [stack.enter_context(analysis_fixture()) for _ in range(3)]
        for store, job in jobs[:2]:
            assert store.claim(job.id, job.token, job.created_at).state == "running"
        store, third = jobs[2]
        assert store.claim(third.id, third.token, third.created_at) is None
        deferred = store.get(third.id)
        assert deferred.state == "queued" and deferred.attempts == 0
        assert deferred.token != third.token and deferred.dispatch_pending
        first_store, first = jobs[0]
        first_store.finish(first.id, first.token, "failed", "fixture", first.created_at)
        running = store.claim(deferred.id, deferred.token, deferred.created_at)
        assert running.state == "running" and running.attempts == 1
