import asyncio
import logging
from contextlib import suppress

from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from services.adapters.analysis_queue import RQDispatch
from services.adapters.analysis_store import PostgresAnalyses
from services.adapters.engine_binary import engine_identity, selected_artifact
from services.adapters.game_store import PostgresGameStore
from services.api.app.settings import Settings
from services.application.analysis import AnalysisService


class AnalysisResources:
    def __init__(self, settings: Settings, engine: Engine | None = None) -> None:
        self.owned_store = (
            PostgresGameStore(settings.database_url.get_secret_value()) if engine is None else None
        )
        database = (
            engine if engine is not None else self.owned_store.engine if self.owned_store else None
        )
        assert database is not None
        self.redis = Redis.from_url(
            settings.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=2
        )
        artifact = selected_artifact(settings.engine_platform)
        self.service = AnalysisService(
            PostgresAnalyses(database),
            RQDispatch(self.redis, artifact.binary_sha256),
            engine_identity(artifact),
            settings.analysis_ip_jobs_per_hour,
        )
        self.task: asyncio.Task[None] | None = None

    def start(self) -> None:
        self.task = asyncio.create_task(self.reconcile())

    async def reconcile(self) -> None:
        while True:
            try:
                await self.service.reconcile()
            except RedisError, SQLAlchemyError, OSError:
                logging.getLogger(__name__).warning("analysis_reconciliation_unavailable")
            await asyncio.sleep(2)

    async def close(self) -> None:
        if self.task is not None:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task
        self.redis.close()
        if self.owned_store is not None:
            self.owned_store.close()
