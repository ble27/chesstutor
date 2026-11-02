import pytest

from services.core.games.values import Ply


@pytest.mark.parametrize("index", [0, 1, 299, 300])
def test_valid_ply(index: int) -> None:
    assert Ply(index).index == index


@pytest.mark.parametrize("index", [-1, 301, True, 1.5, "1"])
def test_invalid_ply(index: object) -> None:
    with pytest.raises(ValueError):
        Ply(index)  # type: ignore[arg-type]
