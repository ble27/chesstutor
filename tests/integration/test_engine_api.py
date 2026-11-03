import asyncio
from time import perf_counter
from uuid import UUID

import httpx
import pytest

from services.api.app.main import create_app
from services.api.app.settings import Settings
from services.application.analysis import AnalysisService
from services.worker.analysis import execute
from tests.integration.analysis_fixtures import analysis_fixture
from tests.integration.test_analysis_jobs import Dispatch


@pytest.mark.integration
def test_api_remains_responsive_while_worker_persists_each_ply():
    asyncio.run(api_scenario())


async def api_scenario():
    with analysis_fixture() as (store, initial):
        service = AnalysisService(store, Dispatch(), initial.engine)
        app = create_app(Settings(_env_file=None), analysis=service)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            challenge = await client.post(
                "/api/v1/analyses",
                headers={"Origin": "http://localhost:5173"},
                json={"game_id": str(initial.game_id), "mode": "quick"},
            )
            assert challenge.status_code == 409
            submitted = await client.post(
                "/api/v1/analyses",
                headers={"Origin": "http://localhost:5173"},
                json={"game_id": str(initial.game_id), "mode": "quick"},
            )
            assert submitted.status_code == 202
            job = store.get(UUID(submitted.json()["id"]))
            started = perf_counter()
            task = asyncio.create_task(asyncio.to_thread(execute, str(job.id), str(job.token)))
            reads = []
            while not task.done():
                before = perf_counter()
                live = await asyncio.wait_for(client.get("/api/v1/health/live"), 2)
                result = await asyncio.wait_for(client.get(f"/api/v1/analyses/{job.id}"), 2)
                reads.append(perf_counter() - before)
                assert live.status_code == result.status_code == 200
                payload = result.json()
                assert payload["completed_plies"] == len(payload["evidence"])
                await asyncio.sleep(0.05)
            await task
            completed = await client.get(f"/api/v1/analyses/{job.id}")
            assert completed.json()["state"] == "completed", completed.text
            print(
                f"Quick four-ply job: {perf_counter() - started:.3f}s; "
                f"max paired API read: {max(reads):.3f}s"
            )
