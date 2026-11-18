from math import exp

import pytest

from services.core.analysis.accuracy import accuracy_summary, move_accuracy, win_percent
from services.core.analysis.values import CentipawnScore, MateScore


def test_logistic_and_exact_coefficients() -> None:
    assert win_percent(CentipawnScore(0, "white"), "white") == 50
    assert win_percent(CentipawnScore(100, "white"), "black") == pytest.approx(
        100 / (1 + exp(0.368208))
    )
    assert move_accuracy(60, 40) == pytest.approx(103.1668 * exp(-0.04354 * 20) - 3.1669)
    assert move_accuracy(40, 60) == pytest.approx(99.9999)
    assert move_accuracy(100, 0) == 0


def test_mate_endpoints_and_terminal_zero() -> None:
    assert win_percent(MateScore(3, "black"), "black") == 100
    assert win_percent(MateScore(-3, "black"), "black") == 0
    assert win_percent(MateScore(0, "white"), "black", "0-1") == 100
    assert win_percent(MateScore(0, "white"), "white") is None


def test_empty_and_partial_coverage() -> None:
    summary = accuracy_summary([], 4, "running")
    assert summary.players["white"].accuracy is None
    assert summary.players["white"].scored_plies == 0
    assert not summary.complete


def test_blend_penalizes_a_zero_and_uses_weights() -> None:
    from services.core.analysis.accuracy import blend

    assert blend([(100, 1), (0, 1)]) == 25
    assert blend([(100, 12), (50, 1)]) == pytest.approx((100 * 12 / 13 + 50 / 13 + 2 / 0.03) / 2)


def test_coverage_excludes_unstable_and_bounded_pairs() -> None:
    from dataclasses import replace

    from services.core.analysis.values import Wdl
    from tests.unit.test_lessons import LOOSE_ROOK, evidence, line

    best = line(LOOSE_ROOK, ["d1d4"], Wdl(900, 100, 0, "white"))
    item = evidence(LOOSE_ROOK, "g1h1", [best])
    summary = accuracy_summary([item], 3, "running", "black")
    assert summary.players["white"].scored_plies == 1
    assert summary.players["black"].total_plies == 2
    assert summary.moves[0].ply == item.ply
    assert not summary.complete
    for invalid in [
        replace(item, status="unstable"),
        replace(item, played=replace(item.played, bounded=True)),
    ]:
        assert accuracy_summary([invalid], 1, "completed").players["white"].accuracy is None
