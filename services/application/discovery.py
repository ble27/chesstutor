import asyncio
import hashlib
import json
from dataclasses import asdict
from typing import Literal, cast
from uuid import UUID

from services.adapters.game_store import GameStore
from services.adapters.provider_data import ProviderGame, archive_months, provider_games
from services.adapters.pubapi import PubAPI
from services.api.app.game_schemas import (
    ArchivesResponse,
    GameResponse,
    GamesResponse,
    PositionResponse,
)
from services.core.games.discovery import (
    DiscoveryError,
    cursor_offset,
    month_path,
    page_cursor,
    username,
)
from services.core.games.importer import parse_game


class Discovery:
    def __init__(self, provider: PubAPI, store: GameStore) -> None:
        self.provider, self.store = provider, store

    async def archives(self, player: str) -> ArchivesResponse:
        player = username(player)
        document = await self.provider.get(f"/player/{player}/games/archives")
        return ArchivesResponse(
            username=player,
            months=archive_months(document.payload, player),
            fetched_at=document.fetched_at,
            stale=document.stale,
        )

    async def games(
        self,
        player: str,
        year: int,
        month: int,
        cursor: str | None,
        color: Literal["white", "black"] | None,
        opponent: str | None,
        time_class: str | None,
    ) -> GamesResponse:
        player = username(player)
        opponent = username(opponent) if opponent else None
        path = month_path(player, year, month)
        document = await self.provider.get(path)
        records = await asyncio.to_thread(provider_games, document.payload, player)
        filtered = [
            record
            for record in records
            if self.matches(record, player, color, opponent, time_class)
        ]
        snapshot = hashlib.sha256(
            json.dumps([record.model_dump() for record in records], sort_keys=True).encode()
        ).hexdigest()
        context = json.dumps([path, color, opponent, time_class, snapshot])
        offset = cursor_offset(cursor, context)
        if offset > len(filtered):
            raise DiscoveryError("invalid_cursor", "Restart this month's game list.")
        selected = filtered[offset : offset + 20]
        summaries = [record.summary() for record in selected]
        await asyncio.to_thread(
            self.store.stage,
            [
                (summary.id, record.model_dump())
                for summary, record in zip(summaries, selected, strict=True)
            ],
        )
        return GamesResponse(
            games=summaries,
            fetched_at=document.fetched_at,
            stale=document.stale,
            next_cursor=page_cursor(offset + 20, context) if offset + 20 < len(filtered) else None,
        )

    @staticmethod
    def matches(
        game: ProviderGame,
        player: str,
        color: str | None,
        opponent: str | None,
        time_class: str | None,
    ) -> bool:
        is_white = game.white.username.lower() == player
        other = game.black.username if is_white else game.white.username
        return (
            (color is None or (color == "white") == is_white)
            and (opponent is None or other.lower() == opponent)
            and (time_class is None or game.time_class == time_class)
        )

    async def game(self, game_id: UUID) -> GameResponse:
        return await asyncio.to_thread(self.import_game, game_id)

    def import_game(self, game_id: UUID) -> GameResponse:
        raw = self.store.source(game_id)
        if raw is None:
            existing = self.store.latest(game_id)
            if existing is not None:
                return existing
            raise DiscoveryError("game_not_found", "Search for this game again.", 404)
        record = ProviderGame.model_validate(raw)
        summary = record.summary()
        if summary.eligibility != "available":
            raise DiscoveryError(
                summary.eligibility,
                "This game cannot be imported. Choose a completed standard game.",
            )
        imported = parse_game(
            record.pgn or "", record.rules, record.white.result or "", record.black.result or ""
        )
        result = GameResponse(
            game=summary,
            version=1,
            pgn_hash=imported.pgn_hash,
            initial_fen=imported.initial_fen,
            result=cast(Literal["1-0", "0-1", "1/2-1/2"], imported.result),
            positions=[PositionResponse(**asdict(position)) for position in imported.positions],
        )
        return self.store.save(result, imported.pgn)
