import math

import chess
import chess.engine

from services.core.analysis.values import (
    CentipawnScore,
    Color,
    EngineLine,
    MateScore,
    Score,
    VariationMove,
    Wdl,
)


def typed_score(value: chess.engine.Score, pov: Color) -> Score:
    if value.is_mate():
        distance = value.mate()
        if distance is None:
            raise ValueError("Missing mate distance")
        return MateScore(distance, pov)
    cp = value.score()
    if cp is None:
        raise ValueError("Missing centipawn score")
    return CentipawnScore(cp, pov)


def legal_variation(board: chess.Board, moves: list[chess.Move]) -> tuple[VariationMove, ...]:
    if not moves or len(moves) > 300:
        raise ValueError("Missing or oversized engine variation")
    replay, result = board.copy(), []
    for move in moves:
        if replay.is_game_over() or move not in replay.legal_moves:
            raise ValueError("Illegal engine variation")
        san = replay.san(move)
        replay.push(move)
        result.append(VariationMove(move.uci(), san, replay.fen()))
    return tuple(result)


def normalise_line(board: chess.Board, info: chess.engine.InfoDict) -> EngineLine:
    score = info.get("score")
    depth, nodes, seconds = info.get("depth", 0), info.get("nodes", 0), info.get("time", 0.0)
    if score is None or depth < 1 or nodes < 1 or not math.isfinite(seconds) or seconds < 0:
        raise ValueError("Incomplete engine evidence")
    mover: Color = "white" if board.turn else "black"
    raw_wdl = info.get("wdl")
    wdl = None
    if raw_wdl is not None:
        values = raw_wdl.pov(board.turn)
        if min(values) < 0 or sum(values) != 1000:
            raise ValueError("Invalid engine WDL")
        wdl = Wdl(values.wins, values.draws, values.losses, mover)
    return EngineLine(
        typed_score(score.white(), "white"),
        typed_score(score.pov(board.turn), mover),
        wdl,
        depth,
        nodes,
        round(seconds * 1000),
        legal_variation(board, info.get("pv", [])),
        bool(info.get("lowerbound") or info.get("upperbound")),
    )
