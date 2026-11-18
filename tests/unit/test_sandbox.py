import chess
import pytest

from services.core.sandbox import sandbox_position


def test_preserves_history_and_rejects_illegal_moves() -> None:
    position = sandbox_position(chess.STARTING_FEN, ["e2e4"], ["e7e5", "g1f3"])
    board = chess.Board()
    for move in ["e2e4", "e7e5", "g1f3"]:
        board.push_uci(move)
    assert position.fen == board.fen()
    assert position.moves == ("e2e4", "e7e5", "g1f3")
    assert "b8c6" in position.legal_moves
    with pytest.raises(ValueError):
        sandbox_position(chess.STARTING_FEN, ["e2e4"], ["e2e5"])


def test_setup_promotion_and_branch_bound() -> None:
    position = sandbox_position("7k/P7/8/8/8/8/8/7K w - - 0 1", [], ["a7a8n"])
    assert position.positions[0].san == "a8=N"
    with pytest.raises(ValueError):
        sandbox_position(chess.STARTING_FEN, [], ["g1f3"] * 101)


@pytest.mark.parametrize(
    ("history", "branch", "square", "piece"),
    [
        (["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"], ["e1g1"], "f1", "R"),
        (["e2e4", "a7a6", "e4e5", "d7d5"], ["e5d6"], "d6", "P"),
    ],
)
def test_special_moves_use_backend_rules(history, branch, square, piece) -> None:
    position = sandbox_position(chess.STARTING_FEN, history, branch)
    assert chess.Board(position.fen).piece_at(chess.parse_square(square)).symbol() == piece


def test_draw_claim_uses_recorded_history_not_only_fen() -> None:
    history = ["g1f3", "g8f6", "f3g1", "f6g8"] * 2
    assert sandbox_position(chess.STARTING_FEN, history, []).claimable_draw
