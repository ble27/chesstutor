import asyncio

import httpx
import pytest

from services.adapters.pubapi import PubAPI
from services.application.discovery import Discovery
from services.core.games.discovery import DiscoveryError
from tests.unit.discovery_fakes import Clock, MemoryCache, MemoryStore


def test_current_ratings_use_stats_not_game_history():
    async def scenario():
        clock = Clock()
        requests = []

        def handler(request):
            requests.append(str(request.url))
            return httpx.Response(
                200,
                json={
                    "chess_rapid": {"last": {"rating": 1512}},
                    "chess_blitz": {"last": {"rating": 1324}},
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = Discovery(
                PubAPI(client, MemoryCache(), "Test contact", clock.now, clock.sleep), MemoryStore()
            )
            result = await service.ratings(" ALICE ")
            assert result.username == "alice"
            assert (result.rapid, result.blitz, result.bullet) == (1512, 1324, None)
            assert requests == ["https://api.chess.com/pub/player/alice/stats"]
            assert not result.stale

    asyncio.run(scenario())


@pytest.mark.parametrize("rating", [-1, 10001, True, "1234"])
def test_rejects_invalid_provider_ratings(rating):
    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200, json={"chess_rapid": {"last": {"rating": rating}}}
                )
            )
        ) as client:
            clock = Clock()
            service = Discovery(
                PubAPI(client, MemoryCache(), "Test contact", clock.now, clock.sleep), MemoryStore()
            )
            with pytest.raises(DiscoveryError) as caught:
                await service.ratings("alice")
            assert caught.value.code == "invalid_data"

    asyncio.run(scenario())


def test_stats_path_allowlist_does_not_allow_arbitrary_urls():
    PubAPI.validate_path("/player/alice/stats")
    with pytest.raises(DiscoveryError):
        PubAPI.validate_path("/player/alice/stats/../../private")


def test_ratings_http_contract_and_invalid_username():
    from fastapi.testclient import TestClient

    from services.api.app.main import create_app
    from tests.unit.analysis_fakes import Service

    http = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"chess_bullet": {"last": {"rating": 1420}}})
        )
    )
    service = Discovery(PubAPI(http, MemoryCache(), "Test contact"), MemoryStore())
    with TestClient(create_app(discovery=service, analysis=Service())) as client:
        response = client.get("/api/v1/players/alice/ratings")
        assert response.status_code == 200
        assert response.json()["bullet"] == 1420
        assert response.json()["rapid"] is None
        assert client.get("/api/v1/players/a!/ratings").status_code == 422
