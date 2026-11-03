import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy

from services.adapters.pubapi import Cached


class MemoryCache:
    def __init__(self):
        self.values = {}
        self.until = 0
        self.lock = asyncio.Lock()

    async def get(self, path):
        return deepcopy(self.values.get(path))

    async def put(self, path, value: Cached):
        self.values[path] = deepcopy(value)

    async def delete(self, path):
        self.values.pop(path, None)

    async def cooldown(self):
        return self.until

    async def defer(self, until):
        self.until = until

    @asynccontextmanager
    async def serial(self):
        async with self.lock:
            yield


class Clock:
    def __init__(self):
        self.time = 1700000000.0
        self.sleeps = []

    def now(self):
        return self.time

    async def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.time += seconds


PGN = '[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0\n'


def provider_game(number=1, **updates):
    return {
        "url": f"https://www.chess.com/game/live/{number}",
        "pgn": PGN,
        "white": {"username": "alice", "rating": 1200, "result": "win"},
        "black": {"username": "bobby", "result": "resigned"},
        "end_time": 1700000000 + number,
        "time_class": "rapid",
        "rules": "chess",
        **updates,
    }


class MemoryStore:
    def __init__(self):
        self.sources = {}
        self.games = {}

    def stage(self, records):
        self.sources.update(records)

    def source(self, game_id):
        return self.sources.get(game_id)

    def latest(self, game_id):
        return self.games.get(game_id)

    def save(self, game, pgn):
        previous = self.games.get(game.game.id)
        if previous and previous.pgn_hash == game.pgn_hash:
            return previous
        saved = game.model_copy(update={"version": previous.version + 1 if previous else 1})
        self.games[game.game.id] = saved
        return saved

    def close(self):
        pass
