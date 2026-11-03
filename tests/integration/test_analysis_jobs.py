import asyncio
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from sqlalchemy import delete

from services.adapters.analysis_store import PostgresAnalyses, analyses
from services.adapters.engine_binary import selected_artifact, verify_binary
from services.adapters.game_store import PostgresGameStore, games, sources
from services.adapters.pubapi import PubAPI
from services.api.app.main import create_app
from services.api.app.settings import Settings
from services.application.analysis import AnalysisService
from services.application.discovery import Discovery
from tests.unit.discovery_fakes import MemoryCache, provider_game


class Dispatch:
    def __init__(self):
        self.calls = []
        self.available = True
        self.broken = False

    def ready(self):
        return self.available

    def enqueue(self, identifier, token):
        self.calls.append((identifier, token))
        if self.broken:
            raise ConnectionError("fixture enqueue failure")


@pytest.mark.integration
def test_owned_idempotent_jobs_survive_enqueue_failure_and_stale_workers():
    asyncio.run(job_scenario())


async def job_scenario():
    settings = Settings(_env_file=None)
    game_store = PostgresGameStore(settings.database_url.get_secret_value())
    store = PostgresAnalyses(game_store.engine)
    dispatch = Dispatch()
    provenance = verify_binary(Path("bin/stockfish"), selected_artifact())
    service = AnalysisService(store, dispatch, provenance)
    record = provider_game(int(uuid4().hex[:12], 16), end_time=1700000000)
    source_id = None
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"games": [record]}))
    ) as upstream:
        discovery = Discovery(PubAPI(upstream, MemoryCache(), "ChessTutor fixture"), game_store)
        listing = await discovery.games("alice", 2026, 11, None, None, None, None)
        source_id = listing.games[0].id
        await discovery.game(source_id)
        app = create_app(settings=settings, discovery=discovery, analysis=service)
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                headers = {"Origin": "http://localhost:5173"}
                dispatch.broken = True
                challenge = await client.post(
                    "/api/v1/analyses",
                    json={"game_id": str(source_id), "mode": "quick"},
                    headers=headers,
                )
                assert challenge.status_code == 409
                response = await client.post(
                    "/api/v1/analyses",
                    json={"game_id": str(source_id), "mode": "quick"},
                    headers=headers,
                )
                assert response.status_code == 202, response.text
                job_id = response.json()["id"]
                assert response.json()["dispatch_pending"] is True
                repeated = await client.post(
                    "/api/v1/analyses",
                    json={"game_id": str(source_id), "mode": "quick"},
                    headers=headers,
                )
                assert repeated.json()["id"] == job_id
                dispatch.broken = False
                await service.reconcile()
                queued = await client.get(f"/api/v1/analyses/{job_id}")
                assert queued.json()["dispatch_pending"] is False
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url="http://test"
                ) as other:
                    denied = await other.post(f"/api/v1/analyses/{job_id}/cancel", headers=headers)
                    assert denied.status_code == 403
                cancelled = await client.post(f"/api/v1/analyses/{job_id}/cancel", headers=headers)
                assert cancelled.json()["state"] == "cancelled"
                again = await client.post(f"/api/v1/analyses/{job_id}/cancel", headers=headers)
                assert again.json()["state"] == "cancelled"
        finally:
            with game_store.engine.begin() as connection:
                connection.execute(delete(analyses).where(analyses.c.game_id == source_id))
                connection.execute(delete(games).where(games.c.id == source_id))
                connection.execute(delete(sources).where(sources.c.id == source_id))
            game_store.close()


@pytest.mark.integration
def test_lost_first_job_response_retries_with_established_owner_without_duplicate(monkeypatch):
    from tests.integration.analysis_fixtures import analysis_fixture

    async def scenario():
        with analysis_fixture() as (store, seed):
            store.cancel(seed.id, seed.owner, seed.created_at)
            service = AnalysisService(store, Dispatch(), seed.engine)
            app = create_app(Settings(_env_file=None), analysis=service)
            headers = {"Origin": "http://localhost:5173"}
            payload = {"game_id": str(seed.game_id), "mode": "quick"}
            snapshot = store.snapshot
            lost = True

            def lose_response(identifier):
                nonlocal lost
                if lost:
                    lost = False
                    raise OSError("fixture response lost after persistence")
                return snapshot(identifier)

            monkeypatch.setattr(store, "snapshot", lose_response)
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                challenge = await client.post("/api/v1/analyses", json=payload, headers=headers)
                assert challenge.status_code == 409
                assert not store.pending()
                cookie = client.cookies.get("chess_session")
                with pytest.raises(OSError, match="response lost"):
                    await client.post("/api/v1/analyses", json=payload, headers=headers)
                pending = store.pending()
                assert len(pending) == 1
                retried = await client.post("/api/v1/analyses", json=payload, headers=headers)
                assert retried.status_code == 202
                assert retried.json()["id"] == str(pending[0].id)
                assert len(store.pending()) == 1
                assert client.cookies.get("chess_session") == cookie

    asyncio.run(scenario())
