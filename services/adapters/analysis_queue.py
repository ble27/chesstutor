from uuid import UUID

from redis import Redis
from rq import Queue, Worker
from rq.exceptions import NoSuchJobError
from rq.job import Job, JobStatus
from rq.serializers import JSONSerializer


class RQDispatch:
    def __init__(
        self, connection: Redis, binary_sha256: str, queue_name: str | None = None
    ) -> None:
        self.redis, self.binary_sha256 = connection, binary_sha256
        self.queue = Queue(
            queue_name or engine_queue(binary_sha256),
            connection=connection,
            serializer=JSONSerializer,
        )

    def ready(self, hostname: str | None = None) -> bool:
        for worker in Worker.all(connection=self.redis, queue=self.queue):
            value = self.redis.get("chesstutor:engine-ready:" + worker.name)
            if value == self.binary_sha256.encode() and (
                hostname is None or worker.hostname == hostname
            ):
                return True
        return False

    def enqueue(self, identifier: UUID, token: UUID) -> None:
        job_id = f"analysis-{identifier}-{token}"
        lock = self.redis.lock("chesstutor:dispatch:" + job_id, timeout=10, blocking_timeout=0.1)
        if not lock.acquire():
            raise TimeoutError("Dispatch reconciliation is busy")
        try:
            try:
                existing = Job.fetch(job_id, connection=self.redis, serializer=JSONSerializer)
                if existing.get_status() in (JobStatus.QUEUED, JobStatus.STARTED):
                    return
                existing.delete()
            except NoSuchJobError:
                pass
            self.queue.enqueue_call(
                "services.worker.analysis.execute",
                args=[str(identifier), str(token)],
                job_id=job_id,
                timeout=570,
                ttl=3600,
                result_ttl=0,
                failure_ttl=3600,
                description="bounded chess analysis",
                unique=True,
            )
        finally:
            lock.release()


def engine_queue(binary_sha256: str) -> str:
    # Different pinned builds must never consume each other's jobs on shared Redis.
    return "analysis-" + binary_sha256[:16]
