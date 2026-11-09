"""Plain-language reasons for a move, each proved by the board (PRD section 7)."""

import chess
import pytest

from services.core.coaching.motifs import move_motifs

CASES = [
    ("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1", "a1a8", "mate"),
    ("6k1/8/8/3q4/2B5/8/8/6K1 w - - 0 1", "c4d5", "capture_free"),
    ("r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1", "d5c7", "fork"),
    ("4k2r/8/8/8/8/8/8/R3K3 w - - 0 1", "a1a8", "skewer"),
    ("4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1", "f1b5", "pin"),
    ("4k3/8/8/8/8/8/4N3/4RK2 w - - 0 1", "e2c3", "discovered_check"),
    ("4k3/8/8/8/8/8/8/4K2R w - - 0 1", "h1h8", "check"),
    ("6k1/8/8/8/6b1/8/8/3R2K1 w - - 0 1", "d1d4", "save_piece"),
    ("4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "a1d1", "open_file"),
    ("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1", "e1g1", "castle"),
    (chess.STARTING_FEN, "g1f3", "develop"),
    (chess.STARTING_FEN, "e2e4", "center_pawn"),
]


@pytest.mark.parametrize(("fen", "uci", "kind"), CASES)
def test_the_first_reason_names_what_the_move_does(fen, uci, kind):
    board = chess.Board(fen)
    motifs = move_motifs(board, chess.Move.from_uci(uci))
    assert motifs and motifs[0].kind == kind


def test_values_are_typed_pieces_and_squares():
    board = chess.Board("6k1/8/8/3q4/2B5/8/8/6K1 w - - 0 1")
    values = move_motifs(board, chess.Move.from_uci("c4d5"))[0].values
    assert values["attacker_piece"] == "bishop" and values["target_piece"] == "queen"
    assert values["attacker_square"] == "c4" and values["target_square"] == "d5"


def test_open_file_names_the_file():
    board = chess.Board("4k3/8/8/8/8/8/8/R3K3 w - - 0 1")
    assert move_motifs(board, chess.Move.from_uci("a1d1"))[0].values["file"] == "d"


def test_a_quiet_move_has_no_claimed_reason():
    board = chess.Board("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")
    assert move_motifs(board, chess.Move.from_uci("e1d1")) == []


def test_a_fork_by_a_capturable_piece_is_not_claimed():
    board = chess.Board("r2qk3/2p5/8/3N4/8/8/8/4K3 w - - 0 1")
    kinds = [m.kind for m in move_motifs(board, chess.Move.from_uci("d5c7"))]
    assert "fork" not in kinds
