import asyncio

import chess
from redis import Redis
from redis.client import Pipeline
from rq import Queue, Worker
from rq.serializers import JSONSerializer

from services.adapters.analysis_queue import engine_queue
from services.adapters.engine_binary import selected_artifact, verify_binary
from services.adapters.stockfish import open_engine
from services.api.app.settings import Settings


class ReadyWorker(Worker):
    def __init__(
        self, queue: Queue, connection: Redis, binary_sha256: str, name: str | None = None
    ) -> None:
        self.binary_sha256 = binary_sha256
        super().__init__(
            [queue],
            connection=connection,
            serializer=JSONSerializer,
            name=name,
            worker_ttl=60,
            job_monitoring_interval=1,
            maintenance_interval=5,
            log_job_description=False,
        )

    def heartbeat(self, timeout: int | None = None, pipeline: Pipeline | None = None) -> None:
        super().heartbeat(timeout=timeout, pipeline=pipeline)
        self.connection.setex("chesstutor:engine-ready:" + self.name, 90, self.binary_sha256)


async def engine_probe(settings: Settings) -> None:
    async def checkpoint() -> None:
        pass

    async with asyncio.timeout(10), open_engine(settings.engine_path) as engine:
        lines = await engine.search(chess.Board(), 0.1, 1, None, checkpoint)
        if not lines or lines[0].wdl is None:
            raise ValueError("Engine readiness requires legal search output with WDL")


def main() -> None:
    settings = Settings()
    artifact = selected_artifact(settings.engine_platform)
    verify_binary(settings.engine_path, artifact)
    asyncio.run(engine_probe(settings))
    with Redis.from_url(
        settings.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=50
    ) as connection:
        queue = Queue(
            engine_queue(artifact.binary_sha256), connection=connection, serializer=JSONSerializer
        )
        worker = ReadyWorker(queue, connection, artifact.binary_sha256)
        try:
            worker.work(logging_level="WARNING")
        finally:
            connection.delete("chesstutor:engine-ready:" + worker.name)


if __name__ == "__main__":
    main()
