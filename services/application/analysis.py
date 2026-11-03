import asyncio
from collections.abc import Callable
from datetime import datetime
from typing import Protocol
from uuid import UUID

from pydantic import JsonValue, TypeAdapter
from redis.exceptions import RedisError

from services.adapters.analysis_records import StoredJob
from services.adapters.analysis_store import PostgresAnalyses, utc_now
from services.api.app.analysis_schemas import AnalysisResponse
from services.core.analysis.values import AnalysisError, Mode


class Dispatch(Protocol):
    def ready(self) -> bool: ...
    def enqueue(self, identifier: UUID, token: UUID) -> None: ...


class AnalysisService:
    def __init__(
        self,
        store: PostgresAnalyses,
        dispatch: Dispatch,
        engine: dict[str, object],
        ip_limit: int = 20,
        now: Callable[[], datetime] = utc_now,
    ) -> None:
        self.store, self.dispatch, self.ip_limit, self.now = store, dispatch, ip_limit, now
        self.engine = TypeAdapter(dict[str, JsonValue]).validate_python(engine)

    async def create(self, game_id: UUID, mode: Mode, owner: str, ip: str) -> AnalysisResponse:
        try:
            ready = await asyncio.to_thread(self.dispatch.ready)
        except RedisError, OSError:
            ready = False
        job, cached = await asyncio.to_thread(
            self.store.submit,
            game_id,
            mode,
            owner,
            ip,
            self.engine,
            self.now(),
            self.ip_limit,
            ready,
        )
        if job.state == "queued":
            await self.dispatch_job(job)
            job = await asyncio.to_thread(self.store.get, job.id)
        job, evidence = await asyncio.to_thread(self.store.snapshot, job.id)
        return job.response(owner, evidence, cached)

    async def read(self, identifier: UUID, owner: str) -> AnalysisResponse:
        job = await asyncio.to_thread(self.store.get, identifier)
        if job.owner != owner and job.state != "completed":
            raise AnalysisError("not_owner", "This analysis belongs to another session.", 403)
        if job.state == "queued":
            await self.dispatch_job(job)
            job = await asyncio.to_thread(self.store.get, identifier)
        job, evidence = await asyncio.to_thread(self.store.snapshot, identifier)
        return job.response(owner, evidence)

    async def cancel(self, identifier: UUID, owner: str) -> AnalysisResponse:
        job = await asyncio.to_thread(self.store.cancel, identifier, owner, self.now())
        job, evidence = await asyncio.to_thread(self.store.snapshot, identifier)
        return job.response(owner, evidence)

    async def dispatch_job(self, job: StoredJob) -> None:
        try:
            await asyncio.to_thread(self.dispatch.enqueue, job.id, job.token)
        except RedisError, OSError:
            return  # Persisted queued intent is retried by reconciliation after recovery.
        await asyncio.to_thread(self.store.dispatched, job.id, job.token)

    async def reconcile(self) -> None:
        await asyncio.to_thread(self.store.recover, self.now())
        for job in await asyncio.to_thread(self.store.pending):
            await self.dispatch_job(job)
