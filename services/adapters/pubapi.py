import asyncio
import json
import math
import random
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Protocol

import httpx
from redis.asyncio import Redis
from redis.exceptions import LockError

from services.core.games.discovery import DiscoveryError

BASE_URL = "https://api.chess.com/pub"
MAX_MONTH_BYTES = 50 * 1024 * 1024


@dataclass
class Cached:
    payload: object
    fetched_at: float
    fresh_until: float
    etag: str | None = None
    modified: str | None = None
    cache_control: str = ""


@dataclass
class Document:
    payload: object
    fetched_at: datetime
    stale: bool


class ProviderCache(Protocol):
    async def get(self, path: str) -> Cached | None: ...
    async def put(self, path: str, value: Cached) -> None: ...
    async def delete(self, path: str) -> None: ...
    async def cooldown(self) -> float: ...
    async def defer(self, until: float) -> None: ...
    def serial(self) -> AbstractAsyncContextManager[None]: ...


class RedisProviderCache:
    def __init__(self, client: Redis, namespace: str = "pubapi") -> None:
        self.client = client
        self.namespace = namespace

    async def get(self, path: str) -> Cached | None:
        raw = await self.client.get(self.namespace + ":cache:" + path)
        return Cached(**json.loads(raw)) if raw is not None else None

    async def put(self, path: str, value: Cached) -> None:
        await self.client.set(
            self.namespace + ":cache:" + path, json.dumps(asdict(value)), ex=7 * 86400
        )

    async def delete(self, path: str) -> None:
        await self.client.delete(self.namespace + ":cache:" + path)

    async def cooldown(self) -> float:
        value = await self.client.get(self.namespace + ":cooldown")
        return float(value) if value else 0

    async def defer(self, until: float) -> None:
        # One shared timestamp stays bounded in size and survives long Retry-After values.
        await self.client.set(self.namespace + ":cooldown", str(until))

    @asynccontextmanager
    async def serial(self) -> AsyncIterator[None]:
        try:
            async with self.client.lock(
                self.namespace + ":serial", timeout=100, blocking_timeout=88
            ):
                yield
        except LockError:
            raise DiscoveryError(
                "upstream_busy", "Public game lookup is busy. Try again shortly.", 503, 2
            ) from None


class PubAPI:
    def __init__(
        self,
        client: httpx.AsyncClient,
        cache: ProviderCache,
        user_agent: str | None,
        now: Callable[[], float] = time.time,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        jitter: Callable[[], float] = random.random,
    ) -> None:
        self.client, self.cache, self.user_agent = client, cache, user_agent
        self.now, self.sleep, self.jitter = now, sleep, jitter

    async def get(self, path: str) -> Document:
        self.validate_path(path)
        cached = await self.cache.get(path)
        if cached is not None and cached.fresh_until > self.now():
            return self.document(cached)
        try:
            # One deadline includes shared-limiter waiting and all network retries.
            async with asyncio.timeout(90):
                async with self.cache.serial():
                    cached = await self.cache.get(path)
                    if cached is not None and cached.fresh_until > self.now():
                        return self.document(cached)
                    return await self.refresh(path, cached)
        except httpx.TimeoutException, TimeoutError:
            error = DiscoveryError("upstream_timeout", "Chess.com took too long to respond.", 503)
        except httpx.HTTPError:
            error = DiscoveryError(
                "upstream_unavailable", "Chess.com is temporarily unavailable.", 503
            )
        except DiscoveryError as exc:
            error = exc
        if (
            cached is not None
            and error.status in {429, 503}
            and not re.search(r"\b(no-cache|must-revalidate)\b", cached.cache_control, re.I)
        ):
            return self.document(cached, stale=True)
        raise error

    @staticmethod
    def validate_path(path: str) -> None:
        if not re.fullmatch(
            r"/player/[a-z0-9_-]{3,25}/(?:stats|games/(?:archives|20\d{2}/(?:0[1-9]|1[0-2])))", path
        ):
            raise DiscoveryError("invalid_path", "Invalid public archive path.")

    def document(self, cached: Cached, stale: bool = False) -> Document:
        return Document(cached.payload, datetime.fromtimestamp(cached.fetched_at, UTC), stale)

    async def refresh(self, path: str, cached: Cached | None) -> Document:
        if not self.user_agent:
            raise DiscoveryError(
                "provider_not_configured",
                "Public lookup needs an operator contact User-Agent.",
                503,
            )
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        }
        if cached is not None:
            if cached.etag:
                headers["If-None-Match"] = cached.etag
            if cached.modified:
                headers["If-Modified-Since"] = cached.modified
        for attempt in range(4):
            wait = max(0, await self.cache.cooldown() - self.now())
            if wait > 20:
                raise DiscoveryError(
                    "upstream_rate_limited",
                    "Chess.com asks us to wait before retrying.",
                    429,
                    math.ceil(wait),
                )
            if wait:
                await self.sleep(wait)
            await self.cache.defer(self.now() + 1)
            async with self.client.stream(
                "GET", BASE_URL + path, headers=headers, follow_redirects=False
            ) as response:
                if response.status_code == 429:
                    delay = self.retry_delay(response.headers.get("Retry-After"), attempt)
                    await self.cache.defer(self.now() + delay)
                    if attempt == 3 or delay > 20:
                        raise DiscoveryError(
                            "upstream_rate_limited",
                            "Chess.com asks us to wait before retrying.",
                            429,
                            math.ceil(delay),
                        )
                else:
                    return await self.read_response(path, response, cached)
        raise AssertionError("Retry loop exhausted")

    def retry_delay(self, header: str | None, attempt: int) -> float:
        try:
            if header is not None and header.isdecimal():
                seconds = float(header)
                if math.isfinite(seconds):
                    return seconds
            if header:
                return max(0, parsedate_to_datetime(header).timestamp() - self.now())
        except ValueError, TypeError, OverflowError:
            pass
        return float(2**attempt) + self.jitter()

    async def read_response(
        self, path: str, response: httpx.Response, cached: Cached | None
    ) -> Document:
        if response.status_code == 304 and cached is not None:
            value = Cached(
                cached.payload,
                self.now(),
                self.now(),
                cached.etag,
                cached.modified,
                cached.cache_control,
            )
        elif response.status_code == 200:
            if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                raise DiscoveryError(
                    "unsupported_encoding",
                    "The provider ignored the uncompressed download request.",
                    502,
                )
            limit = 1024 * 1024 if path.endswith(("archives", "stats")) else MAX_MONTH_BYTES
            body = bytearray()
            async for chunk in response.aiter_bytes(chunk_size=65536):
                body.extend(chunk)
                if len(body) > limit:
                    raise DiscoveryError(
                        "archive_too_large", "The archive exceeds the download size limit.", 502
                    )
            try:
                payload = json.loads(body)
            except ValueError, UnicodeError, RecursionError:
                raise DiscoveryError(
                    "invalid_data", "Chess.com returned unreadable archive data.", 502
                ) from None
            value = Cached(
                payload,
                self.now(),
                self.now(),
                response.headers.get("ETag"),
                response.headers.get("Last-Modified"),
            )
        else:
            await self.reject_status(path, response.status_code)
            raise AssertionError("Unreachable")
        directives = response.headers.get(
            "Cache-Control", cached.cache_control if cached and response.status_code == 304 else ""
        )
        value.cache_control = directives
        value.etag = response.headers.get("ETag", value.etag)
        value.modified = response.headers.get("Last-Modified", value.modified)
        age = response.headers.get("Age", "0")
        match = re.search(r"(?:^|,)\s*max-age=(\d+)", directives, re.I)
        ttl = max(0, int(match[1]) - (int(age) if age.isdecimal() else 0)) if match else 0
        value.fresh_until = self.now() + min(ttl, 86400)
        if re.search(r"\b(no-store|private)\b", directives, re.I):
            await self.cache.delete(path)
        else:
            if re.search(r"\bno-cache\b", directives, re.I):
                value.fresh_until = self.now()
            await self.cache.put(path, value)
        return self.document(value)

    async def reject_status(self, path: str, status: int) -> None:
        if status == 404:
            await self.cache.delete(path)
            code = "player_not_found" if path.endswith("archives") else "month_not_found"
            raise DiscoveryError(code, "No public archive was found for this player or month.", 404)
        if 300 <= status < 400:
            raise DiscoveryError(
                "unsafe_redirect", "The provider redirected outside the approved request.", 502
            )
        raise DiscoveryError("upstream_unavailable", "Chess.com is temporarily unavailable.", 503)
