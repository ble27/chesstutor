import pytest

from services.adapters.provider_data import ProviderGame
from tests.unit.discovery_fakes import provider_game


def test_library_counts_only_validated_moves():
    game = ProviderGame.model_validate(provider_game())
    assert game.summary(include_move_count=True).move_count == 2
    assert (
        ProviderGame.model_validate(provider_game(pgn="invalid"))
        .summary(include_move_count=True)
        .move_count
        is None
    )
    assert game.summary().move_count is None


@pytest.mark.parametrize("black_result", [None, "agreed", "unknown"])
@pytest.mark.parametrize(
    "updates", [{"pgn": None}, {"rules": "chess960"}, {"pgn": "x" * (1024 * 1024 + 1)}]
)
def test_unimportable_game_does_not_invent_result(black_result, updates):
    record = provider_game(**updates)
    record["black"]["result"] = black_result
    assert ProviderGame.model_validate(record).summary().result is None
