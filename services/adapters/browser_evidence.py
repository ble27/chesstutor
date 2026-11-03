"""Legality validation for the browser experiment; no analysis results are stored."""

from dataclasses import replace

import chess
import chess.engine

from services.adapters.stockfish_scores import normalise_line
from services.api.app.browser_schemas import BrowserBatch, BrowserLine
from services.api.app.game_schemas import GameResponse
from services.core.analysis.runner import evidence_status
from services.core.analysis.values import AnalysisError, Color, EngineLine, MoveEvidence


def client_line(board: chess.Board, raw: BrowserLine) -> EngineLine:
    value: chess.engine.Score = (
        chess.engine.Cp(raw.score.value)
        if raw.score.kind == "cp"
        else chess.engine.Mate(raw.score.value)
    )
    info: chess.engine.InfoDict = {
        "score": chess.engine.PovScore(value, board.turn),
        "depth": raw.depth,
        "nodes": raw.nodes,
        "time": raw.time_ms / 1000,
        "pv": [chess.Move.from_uci(move) for move in raw.pv],
    }
    if raw.wdl is not None:
        if len(raw.wdl) != 3 or sum(raw.wdl) != 1000:
            raise ValueError("Invalid WDL")
        info["wdl"] = chess.engine.PovWdl(chess.engine.Wdl(*raw.wdl), board.turn)
    return replace(normalise_line(board, info), bounded=raw.bounded)


def validate_browser_batch(game: GameResponse, batch: BrowserBatch) -> list[MoveEvidence]:
    if game.version != batch.game_version or game.pgn_hash != batch.pgn_hash:
        raise AnalysisError("game_changed", "Reopen the imported game before reviewing.", 409)
    selected = {position.ply: position for position in batch.positions}
    if len(selected) != len(batch.positions) or max(selected) >= len(game.positions):
        raise ValueError("Invalid evidence plies")
    board, result = chess.Board(game.initial_fen), []
    for position in game.positions[1:]:
        if position.uci is None or board.is_game_over():
            raise ValueError("Invalid canonical history")
        move = board.parse_uci(position.uci)
        claimable, root = board.can_claim_draw(), board.fen()
        mover: Color = "white" if board.turn else "black"
        raw = selected.get(position.ply)
        if raw is not None:
            best, played = client_line(board, raw.best), client_line(board, raw.played)
            if played.pv[0].uci != position.uci:
                raise ValueError("Wrong played root")
            status, loss = evidence_status(best, played)
        board.push(move)
        if raw is not None:
            outcome = board.outcome(claim_draw=False)
            result.append(
                MoveEvidence(
                    position.ply,
                    position.ply - 1,
                    root,
                    mover,
                    position.uci,
                    (best,),
                    played,
                    status,
                    loss,
                    claimable,
                    outcome.result() if outcome else None,
                    outcome.termination.name.lower() if outcome else None,
                )
            )
        if position.ply >= max(selected):
            break
    return result
