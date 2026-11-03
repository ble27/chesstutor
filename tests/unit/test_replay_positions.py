import json
from dataclasses import asdict
from pathlib import Path

import pytest

from services.core.games.importer import parse_game

FIXTURES = json.loads(Path("apps/web/src/testFixtures/replay.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("fixture", FIXTURES, ids=[case["name"] for case in FIXTURES])
def test_import_exact_special_move_positions(fixture):
    """Synthetic authored games with literal expected FEN, SAN and UCI sequences."""
    game = parse_game(fixture["pgn"], "chess", fixture["white"], fixture["black"])
    assert game.initial_fen == fixture["positions"][0]["fen"]
    assert [asdict(position) for position in game.positions] == fixture["positions"]
    assert game.result == fixture["result"]
