import hashlib
import io
from dataclasses import dataclass

import chess
import chess.pgn

from services.core.games.discovery import DiscoveryError
from services.core.games.pgn_syntax import validate_pgn_syntax

MAX_PGN_BYTES = 1024 * 1024
MAX_PLIES = 300
DRAW_RESULTS = {"agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"}
LOSS_RESULTS = {
    "checkmated",
    "resigned",
    "timeout",
    "lose",
    "abandoned",
    "kingofthehill",
    "threecheck",
    "bughousepartnerlose",
}


@dataclass(frozen=True)
class Position:
    ply: int
    fen: str
    san: str | None
    uci: str | None


@dataclass(frozen=True)
class ImportedGame:
    pgn_hash: str
    pgn: str
    initial_fen: str
    positions: tuple[Position, ...]
    result: str


class QuietBuilder(chess.pgn.GameBuilder[chess.pgn.Game]):
    def handle_error(self, error: Exception) -> None:
        # Parser diagnostics can contain untrusted PGN; retain errors without logging it.
        self.game.errors.append(error)


def completion_result(white: str, black: str) -> str:
    if white == "win" and black in LOSS_RESULTS:
        return "1-0"
    if black == "win" and white in LOSS_RESULTS:
        return "0-1"
    if white in DRAW_RESULTS and black in DRAW_RESULTS:
        return "1/2-1/2"
    raise DiscoveryError("unfinished_game", "Only consistently completed games can be imported.")


def parse_game(pgn: str, rules: str, white_result: str, black_result: str) -> ImportedGame:
    if rules != "chess":
        raise DiscoveryError("unsupported_game", "Only standard chess is supported.")
    try:
        pgn_bytes = pgn.encode("utf-8")
    except UnicodeError:
        raise DiscoveryError("invalid_pgn", "The PGN is not valid UTF-8 text.") from None
    if len(pgn_bytes) > MAX_PGN_BYTES:
        raise DiscoveryError("game_too_large", "The PGN exceeds the 1 MiB limit.")
    expected = completion_result(white_result, black_result)
    validate_pgn_syntax(pgn, expected)
    try:
        stream = io.StringIO(pgn)
        game = chess.pgn.read_game(stream, Visitor=QuietBuilder)
        if (
            game is None
            or game.errors
            or chess.pgn.read_game(stream, Visitor=QuietBuilder) is not None
        ):
            raise ValueError
        if game.headers.get("Variant", "Standard").lower() not in {"standard", "chess"}:
            raise DiscoveryError("unsupported_game", "Only standard chess is supported.")
        if game.headers.get("Result") != expected:
            raise DiscoveryError("unfinished_game", "PGN and provider completion results disagree.")
        board = game.board()
        if board.chess960 or not board.is_valid():
            raise ValueError
        if ("FEN" in game.headers) != (game.headers.get("SetUp") == "1"):
            raise ValueError
        positions = replay(game, board)
        outcome = board.outcome(claim_draw=False)
        if outcome is not None and outcome.result() != expected:
            raise DiscoveryError("invalid_pgn", "The final position contradicts the game result.")
    except ValueError, IndexError, RecursionError:
        raise DiscoveryError(
            "invalid_pgn", "The PGN contains invalid positions or moves."
        ) from None
    return ImportedGame(
        hashlib.sha256(pgn.encode()).hexdigest(), pgn, positions[0].fen, tuple(positions), expected
    )


def replay(game: chess.pgn.Game, board: chess.Board) -> list[Position]:
    positions = [Position(0, board.fen(), None, None)]
    for ply, move in enumerate(game.mainline_moves(), start=1):
        if ply > MAX_PLIES:
            raise DiscoveryError("game_too_large", "The game exceeds the 300-ply limit.")
        if board.is_game_over(claim_draw=False) or move not in board.legal_moves:
            raise ValueError
        san = board.san(move)
        board.push(move)
        if not board.is_valid():
            raise ValueError
        positions.append(Position(ply, board.fen(), san, move.uci()))
    if len(positions) == 1:
        raise ValueError
    return positions
