from uuid import uuid4

import pytest
from redis import Redis
from rq import Queue
from rq.job import Job
from rq.serializers import JSONSerializer
from rq.worker_registration import unregister

from services.adapters.analysis_queue import RQDispatch
from services.api.app.settings import Settings
from services.worker.main import ReadyWorker
from tests.integration.analysis_fixtures import analysis_fixture


@pytest.mark.integration
def test_live_worker_repairs_expired_registration_before_another_review():
    with Redis.from_url(Settings().redis_url.get_secret_value()) as redis:
        checksum = "fixture-checksum"
        queue = Queue("test-analysis-" + uuid4().hex, connection=redis)
        dispatch = RQDispatch(redis, checksum, queue.name)
        worker = ReadyWorker(queue, redis, checksum, name="fixture-" + uuid4().hex)
        worker.register_birth()
        try:
            redis.delete(worker.key)
            unregister(worker)

            worker.heartbeat()

            assert dispatch.ready(worker.hostname)
        finally:
            worker.register_death()
            redis.delete("chesstutor:engine-ready:" + worker.name)


@pytest.mark.integration
def test_real_redis_dispatch_is_idempotent_and_requires_verified_worker():
    with Redis.from_url(Settings().redis_url.get_secret_value()) as redis:
        identifier, token, checksum = uuid4(), uuid4(), "fixture-checksum"
        queue = Queue("test-analysis-" + uuid4().hex, connection=redis, serializer=JSONSerializer)
        dispatch = RQDispatch(redis, checksum, queue.name)
        worker = ReadyWorker(queue, redis, checksum, name="fixture-" + uuid4().hex)
        worker.register_birth()
        worker.heartbeat()
        job_id = f"analysis-{identifier}-{token}"
        try:
            assert dispatch.ready()
            dispatch.enqueue(identifier, token)
            dispatch.enqueue(identifier, token)
            assert queue.get_job_ids().count(job_id) == 1
            job = Job.fetch(job_id, connection=redis, serializer=JSONSerializer)
            assert job.func_name == "services.worker.analysis.execute"
            assert job.timeout == 570
            assert job.args == [str(identifier), str(token)] or job.args == (
                str(identifier),
                str(token),
            )
        finally:
            job = queue.fetch_job(job_id)
            if job:
                queue.remove(job_id)
                job.delete()
            worker.register_death()
            redis.delete("chesstutor:engine-ready:" + worker.name)
        assert not RQDispatch(redis, "not-the-verified-checksum", queue.name).ready()


@pytest.mark.integration
def test_real_rq_worker_executes_a_persisted_pinned_engine_job():
    with (
        analysis_fixture() as (store, queued),
        Redis.from_url(Settings().redis_url.get_secret_value()) as redis,
    ):
        queue = Queue("test-execute-" + uuid4().hex, connection=redis, serializer=JSONSerializer)
        checksum = str(queued.engine["binary_sha256"])
        dispatch = RQDispatch(redis, checksum, queue.name)
        dispatch.enqueue(queued.id, queued.token)
        worker = ReadyWorker(queue, redis, checksum, name="fixture-" + uuid4().hex)
        try:
            worker.work(burst=True, logging_level="WARNING")
            job, evidence = store.snapshot(queued.id)
            assert job.state == "completed", job.error_code
            assert job.completed_plies == len(evidence) == 4
        finally:
            queue.delete(delete_jobs=True)
            redis.delete("chesstutor:engine-ready:" + worker.name)
