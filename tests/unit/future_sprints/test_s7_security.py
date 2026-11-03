"""PRD §§3,8,9 and AGENTS.md safe boundaries; plan.md S7 regressions."""

import asyncio

import httpx
import pytest

from services.adapters.pubapi import PubAPI
from services.core.games.discovery import DiscoveryError, source_url
from tests.unit.discovery_fakes import Clock, MemoryCache
from tests.unit.future_sprints.contracts import policy


@pytest.mark.parametrize(
    "url",
    [
        "http://www.chess.com/game/live/1",
        "https://chess.com.evil.example/game/live/1",
        "https://www.chess.com@evil.example/game/live/1",
        "https://www.chess.com/game/live/1?next=https://evil.example",
        "https://www.chess.com/game/live/1#fragment",
        "https://www.chess.com/game/live/../daily/1",
        "https://www.chess.com/game/live/%31",
        "file:///etc/passwd",
        "https://127.0.0.1/game/live/1",
        "https://www.chess.com:443/game/live/1",
    ],
)
def test_release_source_allowlist_rejects_unsafe_urls(url):
    with pytest.raises(DiscoveryError):
        source_url(url)


@pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
def test_pubapi_never_follows_a_cross_host_redirect(status):
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        return httpx.Response(status, headers={"Location": "https://evil.example/private"})

    async def scenario() -> None:
        clock = Clock()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = PubAPI(
                client,
                MemoryCache(),
                "ChessTutor (operator@example.test)",
                clock.now,
                clock.sleep,
                lambda: 0.5,
            )
            with pytest.raises(DiscoveryError) as error:
                await provider.get("/player/alice/games/archives")
            assert error.value.code == "unsafe_redirect"

    asyncio.run(scenario())
    assert requests == ["https://api.chess.com/pub/player/alice/games/archives"]


@pytest.mark.parametrize(
    ("owner", "session", "origin", "csrf_valid", "allowed"),
    [
        ("alice", "alice", "http://localhost:5173", True, True),
        ("alice", "bob", "http://localhost:5173", True, False),
        ("alice", None, "http://localhost:5173", True, False),
        ("alice", "alice", "https://evil.example", True, False),
        ("alice", "alice", "http://localhost:5173.evil.example", True, False),
        ("alice", "alice", "null", True, False),
        ("alice", "alice", "http://localhost:5173", False, False),
    ],
)
def test_cancellation_requires_owner_and_valid_request_origin(
    owner, session, origin, csrf_valid, allowed
):
    result = policy("services.core.operations", "authorize_cancellation")(
        owner=owner,
        session=session,
        origin=origin,
        allowed_origins=("http://localhost:5173",),
        csrf_valid=csrf_valid,
    )
    assert result.allowed is allowed
