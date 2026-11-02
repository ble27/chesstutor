import asyncio
from unittest.mock import AsyncMock, patch

from redis.exceptions import ConnectionError as RedisConnectionError

from services.adapters.readiness import ServiceReadiness


def test_dependency_failure_returns_false() -> None:
    probe = ServiceReadiness("unused", "unused", 0.1)
    with (
        patch.object(probe, "_database", new=AsyncMock()),
        patch.object(probe, "_redis", new=AsyncMock(side_effect=RedisConnectionError("private"))),
    ):
        assert asyncio.run(probe.check()) is False


def test_dependency_timeout_is_bounded() -> None:
    async def slow() -> None:
        await asyncio.sleep(10)

    probe = ServiceReadiness("unused", "unused", 0.01)
    with patch.object(probe, "_database", new=slow):
        assert asyncio.run(probe.check()) is False
