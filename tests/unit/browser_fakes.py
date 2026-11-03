from dataclasses import asdict
from uuid import UUID

from services.adapters.provider_data import ProviderGame
from services.api.app.game_schemas import GameResponse
from services.core.games.importer import parse_game
from tests.unit.discovery_fakes import provider_game


def browser_game() -> GameResponse:
    source = ProviderGame.model_validate(provider_game())
    parsed = parse_game('[Result "1-0"]\n\n1. e4 1-0\n', "chess", "win", "resigned")
    summary = source.summary().model_copy(
        update={"id": UUID("381e6db7-0719-5a45-bade-18c73a8b1111")}
    )
    return GameResponse(
        game=summary,
        version=1,
        pgn_hash="a" * 64,
        result="1-0",
        initial_fen=parsed.initial_fen,
        positions=[asdict(position) for position in parsed.positions],
    )
