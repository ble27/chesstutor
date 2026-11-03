import httpx
import pytest
from fastapi.testclient import TestClient

from services.adapters.provider_data import archive_months, provider_games
from services.adapters.pubapi import PubAPI
from services.api.app.main import create_app
from services.application.discovery import Discovery
from services.core.games.discovery import DiscoveryError
from tests.unit.discovery_fakes import Clock, MemoryCache, MemoryStore, provider_game


def discovery_client(records=None):
    clock = Clock()

    def handler(request):
        if request.url.path.endswith("archives"):
            return httpx.Response(
                200,
                json={
                    "archives": [
                        "https://api.chess.com/pub/player/alice/games/2026/10",
                        "https://api.chess.com/pub/player/alice/games/2026/11",
                    ]
                },
            )
        return httpx.Response(
            200,
            json={"games": records if records is not None else [provider_game()]},
            headers={"Cache-Control": "max-age=30"},
        )

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = Discovery(
        PubAPI(http, MemoryCache(), "ChessTutor test", clock.now, clock.sleep), MemoryStore()
    )
    return TestClient(create_app(discovery=service)), service


def test_lookup_import_and_idempotency():
    client, service = discovery_client()
    with client:
        response = client.get("/api/v1/players/%20ALICE%20/archives")
        assert response.json()["months"] == ["2026-11", "2026-10"]
        listing = client.get("/api/v1/players/alice/games?year=2026&month=11")
        summary = listing.json()["games"][0]
        assert summary["black"]["rating"] is None
        path = "/api/v1/games/" + summary["id"]
        first = client.get(path)
        assert first.status_code == 200, first.text
        assert first.json()["version"] == 1
        assert first.json()["positions"][1]["uci"] == "e2e4"
        assert client.get(path).json() == first.json()
        assert client.get("/api/v1/games/00000000-0000-0000-0000-000000000000").status_code == 404


def test_filter_pagination_and_snapshot_context():
    records = [provider_game(number) for number in range(1, 43)]
    records.append(
        provider_game(
            43,
            white={"username": "bobby", "result": "win"},
            black={"username": "alice", "result": "timeout"},
            time_class="blitz",
        )
    )
    client, _ = discovery_client(records)
    with client:
        path = "/api/v1/players/alice/games?year=2026&month=11"
        first = client.get(path).json()
        assert len(first["games"]) == 20
        assert first["games"][0]["source_url"].endswith("/43")
        second = client.get(path + "&cursor=" + first["next_cursor"]).json()
        assert len(second["games"]) == 20
        assert set(game["id"] for game in first["games"]).isdisjoint(
            game["id"] for game in second["games"]
        )
        filtered = client.get(path + "&color=black&opponent=bobby&time_class=blitz").json()
        assert len(filtered["games"]) == 1
        assert filtered["next_cursor"] is None
        changed = client.get(path + "&color=white&cursor=" + first["next_cursor"])
        assert changed.status_code == 422
        assert client.get(path + "&month=13").status_code == 422


@pytest.mark.parametrize("value", [None, {}, {"games": [{}]}])
def test_missing_provider_fields_are_rejected(value):
    with pytest.raises(DiscoveryError) as error:
        provider_games(value, "alice")
    assert error.value.code == "invalid_data"


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example/player/alice/games/2026/11",
        "https://api.chess.com/pub/player/bobby/games/2026/11",
        "https://api.chess.com/pub/player/alice/games/2026/11?url=evil",
        "https://api.chess.com/pub/player/alice/games/2026/13",
    ],
)
def test_archive_urls_are_not_trusted(url):
    with pytest.raises(DiscoveryError):
        archive_months({"archives": [url]}, "alice")


def test_ineligible_games_are_visible_but_cannot_be_imported():
    client, _ = discovery_client([provider_game(rules="chess960")])
    with client:
        record = client.get("/api/v1/players/alice/games?year=2026&month=11").json()["games"][0]
        assert record["eligibility"] == "unsupported_game"
        response = client.get("/api/v1/games/" + record["id"])
        assert response.status_code == 422
        assert response.json()["code"] == "unsupported_game"
