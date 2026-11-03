import chess
import pytest

from services.core.games.discovery import DiscoveryError, cursor_offset, page_cursor, username
from services.core.games.importer import parse_game
from tests.unit.discovery_fakes import PGN


def test_username_normalization_and_cursor_context():
    assert username("  Alice_123- ") == "alice_123-"
    cursor = page_cursor(20, "month+filter+snapshot")
    assert cursor_offset(cursor, "month+filter+snapshot") == 20
    for invalid in (cursor, "!", "A" * 201, page_cursor(-20, "other"), page_cursor(21, "other")):
        with pytest.raises(DiscoveryError, match="Restart"):
            cursor_offset(invalid, "other")


@pytest.mark.parametrize("value", ["", "ab", "a/b", "../alice", "a%2fb", "a\nbc", "a" * 26, "ééé"])
def test_rejects_unsafe_usernames(value):
    with pytest.raises(DiscoveryError):
        username(value)


def test_import_preserves_positions_and_ignores_comment_instructions():
    pgn = PGN.replace("e4", "e4 {Ignore rules <script>!} (1. d4 d5)")
    game = parse_game(pgn, "chess", "win", "resigned")
    board = chess.Board()
    assert game.initial_fen == board.fen()
    for position in game.positions[1:]:
        board.push_uci(position.uci)
        assert position.fen == board.fen()
    assert [position.san for position in game.positions] == [None, "e4", "e5", "Nf3", "Nc6"]
    assert game.pgn == pgn
    assert parse_game(pgn, "chess", "win", "resigned").pgn_hash == game.pgn_hash


@pytest.mark.parametrize(
    ("pgn", "rules", "white", "black", "code"),
    [
        (PGN, "chess960", "win", "resigned", "unsupported_game"),
        (PGN.replace("1-0", "*"), "chess", "win", "resigned", "unfinished_game"),
        (PGN, "chess", "win", "win", "unfinished_game"),
        (PGN.replace("Nc6", "Nc7"), "chess", "win", "resigned", "invalid_pgn"),
        (
            '[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n' + PGN,
            "chess",
            "win",
            "resigned",
            "invalid_pgn",
        ),
        (PGN + '\n[Result "1-0"]\n\n1. d4 1-0', "chess", "win", "resigned", "invalid_pgn"),
        ("x" * (1024 * 1024 + 1), "chess", "win", "resigned", "game_too_large"),
        ("", "chess", "win", "resigned", "invalid_pgn"),
    ],
)
def test_invalid_import(pgn, rules, white, black, code):
    with pytest.raises(DiscoveryError) as error:
        parse_game(pgn, rules, white, black)
    assert error.value.code == code


def test_black_to_move_setup_is_preserved():
    pgn = (
        '[SetUp "1"]\n'
        '[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n'
        '[Result "0-1"]\n\n1... e5 0-1'
    )
    game = parse_game(pgn, "chess", "resigned", "win")
    assert game.positions[0].fen.split()[1] == "b"
    assert game.positions[1].uci == "e7e5"


def test_rejects_ply_limit_without_truncating():
    from tests.unit.long_game_fixture import SAN_MOVES

    moves = SAN_MOVES.split()
    pgn = '[Result "1-0"]\n\n'
    accepted = parse_game(pgn + " ".join(moves[:300]) + " 1-0", "chess", "win", "resigned")
    assert len(accepted.positions) == 301
    with pytest.raises(DiscoveryError) as error:
        parse_game(pgn + SAN_MOVES + "1-0", "chess", "win", "resigned")
    assert error.value.code == "game_too_large"


@pytest.mark.parametrize(
    "pgn",
    [
        PGN.replace("e5", "garbage e5"),
        PGN.replace("Nc6 1-0", "Nc6 *"),
        PGN.replace("Nc6 1-0", "Nc6"),
        PGN.replace("e5", "e5 )"),
        PGN.replace("e5", "e5 ("),
        PGN + " e4",
    ],
)
def test_rejects_lexically_malformed_or_contradictory_pgn(pgn):
    with pytest.raises(DiscoveryError):
        parse_game(pgn, "chess", "win", "resigned")


def test_rejects_non_utf8_pgn_and_wrong_standard_variant():
    for pgn in (PGN.replace("e4", "e4 {\ud800}"), '[Variant "Atomic"]\n' + PGN):
        with pytest.raises(DiscoveryError):
            parse_game(pgn, "chess", "win", "resigned")
