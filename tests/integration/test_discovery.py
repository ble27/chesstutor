import asyncio
from uuid import UUID, uuid4

import httpx
import pytest
from redis.asyncio import Redis
from sqlalchemy import delete, select

from services.adapters.game_store import PostgresGameStore, games, sources
from services.adapters.pubapi import PubAPI, RedisProviderCache
from services.api.app.game_schemas import GameResponse
from services.api.app.main import create_app
from services.api.app.settings import Settings
from services.application.discovery import Discovery
from services.core.games.discovery import DiscoveryError
from tests.unit.discovery_fakes import Clock, provider_game


@pytest.mark.integration
def test_http_import_postgres_versions_and_concurrent_idempotency():
    asyncio.run(import_scenario())


async def import_scenario():
    settings = Settings()
    store = PostgresGameStore(settings.database_url.get_secret_value())
    record = provider_game(int(uuid4().hex[:12], 16), end_time=1700000000)
    record["white"]["username"] = "sprint1-fixture"
    clock, requests = Clock(), []

    def handler(request):
        requests.append(request)
        return httpx.Response(
            200, json={"games": [record]}, headers={"Cache-Control": "max-age=60"}
        )

    identifier = None
    async with Redis.from_url(settings.redis_url.get_secret_value()) as redis:
        cache = RedisProviderCache(redis, namespace=f"test:{uuid4()}")
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            discovery = Discovery(
                PubAPI(http, cache, "ChessTutor integration", clock.now, clock.sleep), store
            )
            app = create_app(discovery=discovery)
            try:
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url="http://test"
                ) as client:
                    summary = await lookup(client)
                    identifier = UUID(summary["id"])
                    path = "/api/v1/games/" + summary["id"]
                    imported = await client.get(path)
                    assert imported.status_code == 200, imported.text
                    game = GameResponse.model_validate(imported.json())
                    versions = await asyncio.gather(
                        *(asyncio.to_thread(store.save, game, record["pgn"]) for _ in range(8))
                    )
                    assert [saved.version for saved in versions] == [1] * 8
                    assert (await client.get(path)).json() == imported.json()
                    await lookup(client)
                    assert len(requests) == 1
                    record["pgn"] = record["pgn"].replace("e4", "e4 {updated provider annotation}")
                    store.stage([(identifier, record)])
                    with pytest.raises(DiscoveryError) as conflict:
                        store.save(game, game.model_dump_json())
                    assert conflict.value.code == "source_changed"
                    updated = await client.get(path)
                    assert updated.status_code == 200, updated.text
                    assert updated.json()["version"] == 2
                    assert updated.json()["pgn_hash"] != imported.json()["pgn_hash"]
                    with store.engine.connect() as connection:
                        rows = connection.execute(
                            select(games).where(games.c.id == identifier)
                        ).all()
                        assert len(rows) == 2
            finally:
                await cache.delete("/player/sprint1-fixture/games/2026/11")
                await redis.delete(cache.namespace + ":cooldown")
                if identifier:
                    with store.engine.begin() as connection:
                        connection.execute(delete(games).where(games.c.id == identifier))
                        connection.execute(delete(sources).where(sources.c.id == identifier))
                store.close()


async def lookup(client):
    listing = await client.get("/api/v1/players/sprint1-fixture/games?year=2026&month=11")
    assert listing.status_code == 200, listing.text
    return listing.json()["games"][0]


@pytest.mark.integration
def test_migration_upgrade_rollback_and_reapply(monkeypatch):
    import psycopg
    from alembic import command
    from alembic.config import Config
    from psycopg import sql
    from psycopg.conninfo import make_conninfo

    settings = Settings()
    name = "sprint1_" + uuid4().hex
    admin_url = make_conninfo(settings.database_url.get_secret_value(), dbname="postgres")
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            from urllib.parse import urlsplit, urlunsplit

            parsed = urlsplit(settings.database_url.get_secret_value())
            url = urlunsplit(parsed._replace(path="/" + name))
            monkeypatch.setenv("CHESS_DATABASE_URL", url)
            config = Config("alembic.ini")
            command.upgrade(config, "head")
            with psycopg.connect(url) as connection:
                assert connection.execute("SELECT to_regclass('games')").fetchone()[0] == "games"
                assert (
                    connection.execute("SELECT to_regclass('analyses')").fetchone()[0] == "analyses"
                )
            command.downgrade(config, "0001")
            with psycopg.connect(url) as connection:
                assert connection.execute("SELECT to_regclass('analyses')").fetchone()[0] is None
                assert (
                    connection.execute("SELECT to_regclass('analysis_evidence')").fetchone()[0]
                    is None
                )
                assert connection.execute("SELECT to_regclass('games')").fetchone()[0] == "games"
            command.upgrade(config, "head")
            command.downgrade(config, "base")
            with psycopg.connect(url) as connection:
                assert connection.execute("SELECT to_regclass('games')").fetchone()[0] is None
            command.upgrade(config, "head")
            with psycopg.connect(url) as connection:
                assert (
                    connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
                    == "0002"
                )
        finally:
            admin.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(name)))


@pytest.mark.integration
def test_shared_redis_clients_coalesce_identical_misses():
    asyncio.run(shared_cache_scenario())


async def shared_cache_scenario():
    settings = Settings()
    namespace = f"test:{uuid4()}"
    clock = Clock()
    requests, started, release = [], asyncio.Event(), asyncio.Event()
    path = "/player/alice/games/archives"

    async def handler(request):
        requests.append(request)
        started.set()
        await release.wait()
        return httpx.Response(200, json={"archives": []}, headers={"Cache-Control": "max-age=60"})

    async with (
        Redis.from_url(settings.redis_url.get_secret_value()) as first_redis,
        Redis.from_url(settings.redis_url.get_secret_value()) as second_redis,
        httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http,
    ):
        first_cache = RedisProviderCache(first_redis, namespace)
        second_cache = RedisProviderCache(second_redis, namespace)
        first = PubAPI(http, first_cache, "ChessTutor integration", clock.now, clock.sleep)
        second = PubAPI(http, second_cache, "ChessTutor integration", clock.now, clock.sleep)
        try:
            async with asyncio.timeout(5):
                one = asyncio.create_task(first.get(path))
                await started.wait()
                two = asyncio.create_task(second.get(path))
                release.set()
                results = await asyncio.gather(one, two)
            assert len(requests) == 1
            assert results[0].payload == results[1].payload
        finally:
            release.set()
            await first_cache.delete(path)
            await first_redis.delete(namespace + ":cooldown")
