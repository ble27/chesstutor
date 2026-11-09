import re
from datetime import UTC, datetime
from typing import Literal, cast

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from services.api.app.game_schemas import GameSummary, Player
from services.core.games.discovery import DiscoveryError, game_id, source_url
from services.core.games.importer import MAX_PGN_BYTES, completion_result, parse_game


class ProviderPlayer(BaseModel):
    model_config = ConfigDict(strict=True)
    username: str = Field(min_length=1, max_length=100)
    rating: int | None = Field(default=None, ge=0, le=10000)
    result: str | None = Field(default=None, max_length=100)


class ProviderGame(BaseModel):
    model_config = ConfigDict(strict=True)
    url: str = Field(max_length=200)
    pgn: str | None = None
    white: ProviderPlayer
    black: ProviderPlayer
    end_time: int | None = Field(default=None, ge=0, le=4102444800)
    time_class: str | None = Field(default=None, max_length=100)
    rules: str = Field(default="unknown", max_length=100)

    def summary(self, *, include_move_count: bool = False) -> GameSummary:
        return GameSummary(
            id=game_id(self.url),
            source_url=source_url(self.url),
            white=Player(**self.white.model_dump()),
            black=Player(**self.black.model_dump()),
            end_time=datetime.fromtimestamp(self.end_time, UTC)
            if self.end_time is not None
            else None,
            time_class=self.time_class,
            rules=self.rules,
            result=self.completed_result(),
            eligibility=self.eligibility(),
            move_count=self.validated_move_count() if include_move_count else None,
        )

    def completed_result(self) -> Literal["1-0", "0-1", "1/2-1/2"] | None:
        try:
            return cast(
                Literal["1-0", "0-1", "1/2-1/2"],
                completion_result(self.white.result or "", self.black.result or ""),
            )
        except DiscoveryError:
            return None

    def validated_move_count(self) -> int | None:
        if self.eligibility() != "available":
            return None
        try:
            game = parse_game(
                self.pgn or "", self.rules, self.white.result or "", self.black.result or ""
            )
        except DiscoveryError:
            return None
        plies = len(game.positions) - 1
        starts_black = game.initial_fen.split()[1] == "b"
        return (plies + int(starts_black) + 1) // 2

    def eligibility(
        self,
    ) -> Literal[
        "available", "unsupported_game", "unfinished_game", "invalid_data", "game_too_large"
    ]:
        if self.rules != "chess":
            return "unsupported_game"
        if not self.pgn:
            return "invalid_data"
        try:
            size = len(self.pgn.encode())
        except UnicodeError:
            return "invalid_data"
        if size > MAX_PGN_BYTES:
            return "game_too_large"
        try:
            completion_result(self.white.result or "", self.black.result or "")
        except DiscoveryError:
            return "unfinished_game"
        return "available"


def archive_months(payload: object, player: str) -> list[str]:
    if not isinstance(payload, dict) or not isinstance(payload.get("archives"), list):
        raise DiscoveryError("invalid_data", "The provider returned an invalid archive index.", 502)
    months = []
    for url in payload["archives"]:
        match = re.fullmatch(
            rf"https://api\.chess\.com/pub/player/{re.escape(player)}/games/(20\d{{2}})/(0[1-9]|1[0-2])",
            url if isinstance(url, str) else "",
        )
        if match is None or not 2007 <= int(match[1]) <= 2100:
            raise DiscoveryError(
                "invalid_data", "The provider returned an unsafe archive URL.", 502
            )
        months.append(f"{match[1]}-{match[2]}")
    return sorted(set(months), reverse=True)


def provider_games(payload: object, player: str) -> list[ProviderGame]:
    if not isinstance(payload, dict) or not isinstance(payload.get("games"), list):
        raise DiscoveryError(
            "invalid_data", "The provider returned an invalid monthly archive.", 502
        )
    try:
        games = [ProviderGame.model_validate(value) for value in payload["games"]]
        for game in games:
            source_url(game.url)
            if player not in {game.white.username.lower(), game.black.username.lower()}:
                raise ValueError
        return sorted(games, key=lambda game: (game.end_time or 0, game.url), reverse=True)
    except ValidationError, ValueError:
        raise DiscoveryError(
            "invalid_data", "A provider game has missing or invalid metadata.", 502
        ) from None
