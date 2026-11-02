import asyncio
import math
from typing import Protocol

import psycopg
from redis.asyncio import Redis
from redis.exceptions import RedisError


class ReadinessProbe(Protocol):
    async def check(self) -> bool: ...


class ServiceReadiness:
    def __init__(self, database_url: str, redis_url: str, timeout_seconds: float) -> None:
        self.database_url = database_url
        self.redis_url = redis_url
        self.timeout_seconds = timeout_seconds

    async def check(self) -> bool:
        try:
            async with asyncio.timeout(self.timeout_seconds):
                await self._database()
                await self._redis()
        except OSError, TimeoutError, psycopg.Error, RedisError:
            return False
        return True

    async def _database(self) -> None:
        connection = await psycopg.AsyncConnection.connect(
            self.database_url, connect_timeout=math.ceil(self.timeout_seconds)
        )
        async with connection:
            await connection.execute("SELECT 1")

    async def _redis(self) -> None:
        async with Redis.from_url(
            self.redis_url,
            socket_connect_timeout=self.timeout_seconds,
            socket_timeout=self.timeout_seconds,
        ) as client:
            await client.ping()
