"""Stateless legal branch replay with complete canonical game history."""

from collections.abc import Sequence
from dataclasses import dataclass

import chess

from services.core.analysis.values import VariationMove


@dataclass(frozen=True)
class SandboxPosition:
    fen: str
    moves: tuple[str, ...]
    positions: tuple[VariationMove, ...]
    legal_moves: tuple[str, ...]
    result: str | None
    claimable_draw: bool


def sandbox_position(
    initial_fen: str, history: Sequence[str], branch: Sequence[str]
) -> SandboxPosition:
    if len(history) > 300 or len(branch) > 100:
        raise ValueError("Branch exceeds its limit")
    board = chess.Board(initial_fen)
    positions: list[VariationMove] = []
    for index, uci in enumerate([*history, *branch]):
        if board.is_game_over():
            raise ValueError("Cannot move after a terminal position")
        move = board.parse_uci(uci)
        san = board.san(move)
        board.push(move)
        if index >= len(history):
            positions.append(VariationMove(uci=uci, san=san, fen=board.fen()))
    outcome = board.outcome()
    return SandboxPosition(
        board.fen(),
        tuple([*history, *branch]),
        tuple(positions),
        tuple(move.uci() for move in board.legal_moves) if outcome is None else (),
        outcome.result() if outcome else None,
        board.can_claim_draw(),
    )
