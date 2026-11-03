import asyncio
from email.utils import formatdate

import httpx
import pytest

from services.adapters.pubapi import Cached, PubAPI
from services.core.games.discovery import DiscoveryError
from tests.unit.discovery_fakes import Clock, MemoryCache

PATH = "/player/alice/games/archives"


def run(handler, action):
    async def scenario():
        clock, cache = Clock(), MemoryCache()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = PubAPI(
                client,
                cache,
                "ChessTutor (contact: operator@example.test)",
                clock.now,
                clock.sleep,
                lambda: 0.5,
            )
            await action(provider, cache, clock)

    asyncio.run(scenario())


def test_cache_hit_304_and_conditional_headers():
    requests = []

    def handler(request):
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(
                200,
                json={"archives": []},
                headers={
                    "ETag": "version1",
                    "Last-Modified": "Mon, 02 Nov 2026 00:00:00 GMT",
                    "Cache-Control": "max-age=30",
                },
            )
        assert request.headers["if-none-match"] == "version1"
        assert "if-modified-since" in request.headers
        return httpx.Response(304, headers={"Cache-Control": "max-age=60"})

    async def action(provider, cache, clock):
        first = await provider.get(PATH)
        assert (await provider.get(PATH)).payload == first.payload
        assert len(requests) == 1
        clock.time += 31
        refreshed = await provider.get(PATH)
        assert refreshed.fetched_at > first.fetched_at
        assert refreshed.stale is False
        assert len(requests) == 2

    run(handler, action)


@pytest.mark.parametrize(
    ("failure", "code", "status"),
    [
        (404, "player_not_found", 404),
        (503, "upstream_unavailable", 503),
        (302, "unsafe_redirect", 502),
        ("timeout", "upstream_timeout", 503),
    ],
)
def test_distinct_failures(failure, code, status):
    def handler(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("test", request=request)
        return httpx.Response(failure, headers={"Location": "https://evil.example/"})

    async def action(provider, cache, clock):
        with pytest.raises(DiscoveryError) as error:
            await provider.get(PATH)
        assert (error.value.code, error.value.status) == (code, status)

    run(handler, action)


def test_429_retry_after_and_fallback_backoff():
    calls = []

    def handler(request):
        calls.append(request)
        headers = {"Retry-After": "3"} if len(calls) == 1 else {}
        return (
            httpx.Response(200, json={})
            if len(calls) == 4
            else httpx.Response(429, headers=headers)
        )

    async def action(provider, cache, clock):
        await provider.get(PATH)
        assert clock.sleeps == [3, 2.5, 4.5]
        assert len(calls) == 4

    run(handler, action)


def test_shared_cooldown_honors_long_retry_after():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "120"})

    async def action(provider, cache, clock):
        for _ in range(2):
            with pytest.raises(DiscoveryError) as error:
                await provider.get(PATH)
            assert error.value.retry_after_seconds == 120
        assert len(calls) == 1
        assert provider.retry_delay(formatdate(clock.time + 10, usegmt=True), 0) == 10

    run(handler, action)


def test_stale_fallback_and_authoritative_404():
    status = [503]

    def handler(request):
        return httpx.Response(status[0])

    async def action(provider, cache, clock):
        cache.values[PATH] = Cached({"archives": []}, clock.time - 100, clock.time - 1)
        assert (await provider.get(PATH)).stale
        status[0] = 404
        with pytest.raises(DiscoveryError) as error:
            await provider.get(PATH)
        assert error.value.status == 404
        assert PATH not in cache.values

    run(handler, action)


@pytest.mark.parametrize("directives", ["no-store", "private", "no-cache", "must-revalidate"])
def test_cache_directives(directives):
    calls = []

    def handler(request):
        calls.append(request)
        if len(calls) == 2:
            return httpx.Response(503)
        return httpx.Response(200, json={}, headers={"Cache-Control": directives})

    async def action(provider, cache, clock):
        await provider.get(PATH)
        with pytest.raises(DiscoveryError):
            await provider.get(PATH)
        if directives in {"private", "no-store"}:
            assert PATH not in cache.values

    run(handler, action)


def test_rejects_unsafe_path_before_network():
    def handler(request):
        raise AssertionError("Network must not be called")

    async def action(provider, cache, clock):
        for path in [
            "https://evil.example",
            "/player/../games/archives",
            "/player/alice/games/2026/13",
        ]:
            with pytest.raises(DiscoveryError):
                await provider.get(path)

    run(handler, action)


def test_coalesces_concurrent_cache_misses():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(200, json={}, headers={"Cache-Control": "max-age=60"})

    async def action(provider, cache, clock):
        await asyncio.gather(*(provider.get(PATH) for _ in range(8)))
        assert len(requests) == 1

    run(handler, action)


def test_limits_decompressed_input(monkeypatch):
    monkeypatch.setattr("services.adapters.pubapi.MAX_MONTH_BYTES", 10)

    async def action(provider, cache, clock):
        with pytest.raises(DiscoveryError) as error:
            await provider.get("/player/alice/games/2026/11")
        assert error.value.code == "archive_too_large"

    run(lambda request: httpx.Response(200, content=b"x" * 11), action)


def test_unexpected_compression_is_rejected_before_body_read():
    class Unreadable(httpx.AsyncByteStream):
        async def __aiter__(self):
            raise AssertionError("Compressed body must not be consumed")
            yield b""

    async def action(provider, cache, clock):
        with pytest.raises(DiscoveryError) as error:
            await provider.get(PATH)
        assert error.value.code == "unsupported_encoding"

    run(
        lambda request: httpx.Response(
            200, stream=Unreadable(), headers={"Content-Encoding": "gzip"}
        ),
        action,
    )


def test_retry_budget_stops_after_three_retries():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(429)

    async def action(provider, cache, clock):
        with pytest.raises(DiscoveryError) as error:
            await provider.get(PATH)
        assert error.value.code == "upstream_rate_limited"
        assert len(requests) == 4

    run(handler, action)


def test_retry_after_longer_than_a_day_is_not_shortened():
    async def action(provider, cache, clock):
        with pytest.raises(DiscoveryError) as error:
            await provider.get(PATH)
        assert error.value.retry_after_seconds == 172800
        assert cache.until == clock.time + 172800

    run(lambda request: httpx.Response(429, headers={"Retry-After": "172800"}), action)
