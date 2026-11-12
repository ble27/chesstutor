"""Optional, bounded search verification before an evidence-backed badge is awarded."""

import asyncio
import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from fractions import Fraction
from time import monotonic
from typing import Literal

import chess

from services.core.analysis.runner import Checkpoint, Engine
from services.core.analysis.values import PRESETS, EngineLine, Mode, MoveEvidence
from services.core.classification.badges import Badge
from services.core.classification.base import POLICY_VERSION, expected_for_mover
from services.core.classification.proofs import BadgeProof, Motif
from services.core.classification.review import ReviewedMove, classify_evidence, legal_line
from services.core.classification.tactics import (
    free_capture,
    material_gain,
    offered_capture_moves,
    takes_same_piece,
    winning_motif,
)

Reserve = Callable[[int], Awaitable[bool]]


@dataclass(frozen=True)
class Candidate:
    motif: Motif | Literal["survival"]
    board: chess.Board
    root_moves: tuple[chess.Move, ...]
    offered_points: int = 0


def candidate_for(
    board: chess.Board,
    evidence: MoveEvidence,
    review: ReviewedMove,
    mode: Mode,
    *,
    allow_sacrifice: bool = True,
) -> Candidate | None:
    label, loss = review.label, review.expected_loss
    if loss is None or label in ("unclassified", "forced"):
        return None
    best = evidence.best[0]
    if allow_sacrifice and mode == "deep" and label in ("best", "good") and loss < 0.02:
        points, captures = offered_capture_moves(board, board.parse_uci(evidence.played_uci))
        if (
            captures
            and evidence.played.wdl
            and expected_for_mover(evidence.played.wdl, evidence.mover) >= Fraction(1, 2)
        ):
            after = board.copy()
            after.push_uci(evidence.played_uci)
            return Candidate("sacrifice", after, captures, points)
    if mode == "deep" and label == "best" and len(evidence.best) >= 2 and best.wdl:
        losses = [
            expected_for_mover(best.wdl, evidence.mover)
            - expected_for_mover(line.wdl, evidence.mover)
            for line in evidence.best
            if line.wdl is not None and not line.bounded
        ]
        if (
            len(losses) == len(evidence.best)
            and sum(value < Fraction(1, 20) for value in losses) == 1
            and min(losses[1:]) >= Fraction(3, 20)
        ):
            runner = min(range(1, len(losses)), key=lambda index: losses[index])
            if not legal_line(board, evidence.best[runner]):
                return None
            return Candidate(
                "unique_move", board.copy(), (board.parse_uci(evidence.best[runner].pv[0].uci),)
            )
    unplayed_win = winning_motif(board, best) or (
        free_capture(board, best) and not takes_same_piece(board, evidence.played_uci, best)
    )
    if loss >= 0.10 and best.pv[0].uci != evidence.played_uci and unplayed_win:
        return Candidate("forced_mate", board.copy(), (board.parse_uci(best.pv[0].uci),))
    return None


def proof_from_line(
    candidate: Candidate, evidence: MoveEvidence, line: EngineLine, cost_ms: int
) -> BadgeProof | None:
    if line.bounded or not line.wdl or not legal_line(candidate.board, line):
        return None
    if not line.pv or chess.Move.from_uci(line.pv[0].uci) not in candidate.root_moves:
        return None
    expected = expected_for_mover(line.wdl, evidence.mover)
    badge: Badge
    motif: Motif | None
    if candidate.motif == "sacrifice":
        if len(line.pv) < 6 or expected < Fraction(1, 2):
            return None
        badge, motif = "brilliant", "sacrifice"
    elif candidate.motif == "unique_move":
        best_wdl = evidence.best[0].wdl
        if best_wdl is None or expected_for_mover(best_wdl, evidence.mover) - expected < Fraction(
            3, 20
        ):
            return None
        badge, motif = "great", "unique_move"
    else:
        if evidence.played.wdl is None or expected - expected_for_mover(
            evidence.played.wdl, evidence.mover
        ) < Fraction(1, 10):
            return None
        motif = winning_motif(candidate.board, line)
        free = motif is None and free_capture(candidate.board, line)
        if free:
            motif = "material_win"  # an undefended piece needs no long forcing proof
        if motif is None:
            return None
        if (
            motif == "forced_mate"
            and winning_motif(candidate.board, evidence.played) == "forced_mate"
        ):
            return None
        if (
            motif == "material_win"
            and not free
            and (
                len(evidence.played.pv) < 6 or material_gain(candidate.board, evidence.played) >= 2
            )
        ):
            return None
        badge = "miss"
    return BadgeProof(
        f"{POLICY_VERSION}:{evidence.ply}:{badge}",
        badge,
        motif,
        evidence.ply,
        candidate.board.fen(),
        line,
        cost_ms,
        candidate.offered_points,
        len(line.pv),
        float(expected),
    )


async def checked_search(
    candidate: Candidate,
    mode: Mode,
    engine: Engine,
    reserve: Reserve,
    checkpoint: Checkpoint,
    deadline: float,
    now: Callable[[], float],
) -> tuple[EngineLine | None, int]:
    seconds = PRESETS[mode].search_seconds
    search_ms = math.ceil(seconds * 1000) + 100
    cost_ms = search_ms + 1000  # UCI cancellation cleanup is bounded to one second.
    if deadline - now() <= cost_ms / 1000 or not await reserve(cost_ms):
        return None, cost_ms
    await checkpoint()
    started = now()
    try:
        async with asyncio.timeout(search_ms / 1000):
            # For sacrifices, the unrestricted opponent search establishes its
            # strongest reply. A declined offer is conservatively not Brilliant.
            roots = None if candidate.motif == "sacrifice" else candidate.root_moves
            lines = await engine.search(candidate.board, seconds, 1, roots, checkpoint)
    except ValueError:
        return None, cost_ms  # Optional bad/missing evidence cannot destroy a base review.
    except TimeoutError:
        if now() >= deadline:
            raise
        return None, cost_ms
    await checkpoint()
    if not lines or now() >= deadline or (now() - started) * 1000 > cost_ms:
        return None, cost_ms
    return lines[0], cost_ms


def survival_candidate(
    board: chess.Board, evidence: MoveEvidence, proof: BadgeProof
) -> Candidate | None:
    offered = chess.Move.from_uci(proof.line.pv[0].uci).to_square
    played = chess.Move.from_uci(evidence.played_uci)
    original = played.from_square if offered == played.to_square else offered
    moves = []
    for move in board.legal_moves:
        if move.from_square != original:
            continue
        following = board.copy()
        following.push(move)
        if not following.is_attacked_by(not board.turn, move.to_square):
            moves.append(move)
    return Candidate("survival", board.copy(), tuple(moves)) if moves else None


def survives(candidate: Candidate, evidence: MoveEvidence, line: EngineLine) -> bool:
    if (
        line.bounded
        or line.wdl is None
        or len(line.pv) < 6
        or not legal_line(candidate.board, line)
    ):
        return False
    first = chess.Move.from_uci(line.pv[0].uci)
    if first not in candidate.root_moves or expected_for_mover(line.wdl, evidence.mover) < Fraction(
        1, 2
    ):
        return False
    board, square = candidate.board.copy(), first.from_square
    for step in line.pv:
        move = chess.Move.from_uci(step.uci)
        if board.turn != candidate.board.turn and move.to_square == square:
            return False
        if move.from_square == square:
            square = move.to_square
        board.push(move)
    return not board.is_attacked_by(not candidate.board.turn, square)


async def checked_survival(
    board: chess.Board,
    evidence: MoveEvidence,
    proof: BadgeProof,
    mode: Mode,
    engine: Engine,
    reserve: Reserve,
    checkpoint: Checkpoint,
    deadline: float,
    now: Callable[[], float],
) -> BadgeProof | None:
    candidate = survival_candidate(board, evidence, proof)
    if candidate is None:
        return None
    line, cost_ms = await checked_search(
        candidate, mode, engine, reserve, checkpoint, deadline, now
    )
    if line is None or not survives(candidate, evidence, line):
        return None
    return replace(proof, survival_line=line, reserved_ms=proof.reserved_ms + cost_ms)


async def verify_move(
    board: chess.Board,
    evidence: MoveEvidence,
    mode: Mode,
    engine: Engine,
    reserve: Reserve,
    checkpoint: Checkpoint,
    *,
    deadline: float,
    now: Callable[[], float] = monotonic,
) -> ReviewedMove:
    review = classify_evidence(evidence, mode)
    candidate = candidate_for(board, evidence, review, mode)
    while candidate is not None:
        line, cost_ms = await checked_search(
            candidate, mode, engine, reserve, checkpoint, deadline, now
        )
        try:
            proof = proof_from_line(candidate, evidence, line, cost_ms) if line else None
        except ValueError:
            proof = None
        if proof and proof.badge == "brilliant":
            proof = await checked_survival(
                board, evidence, proof, mode, engine, reserve, checkpoint, deadline, now
            )
        if proof:
            return replace(review, badges=(proof.badge,), proofs=(proof,))
        if candidate.motif != "sacrifice":
            break
        candidate = candidate_for(board, evidence, review, mode, allow_sacrifice=False)
    return review


def validate_verified_review(
    board: chess.Board, evidence: MoveEvidence, mode: Mode, review: ReviewedMove
) -> None:
    base = classify_evidence(evidence, mode)
    if not review.badges and not review.proofs:
        if review != base:
            raise ValueError("Review disagrees with classified engine evidence")
        return
    candidate = candidate_for(
        board,
        evidence,
        base,
        mode,
        allow_sacrifice=bool(review.proofs and review.proofs[0].badge == "brilliant"),
    )
    if candidate is None or len(review.proofs) != 1:
        raise ValueError("Unsupported badge evidence")
    proof = review.proofs[0]
    if proof.reserved_ms < math.ceil(PRESETS[mode].search_seconds * 1000):
        raise ValueError("Badge search did not receive the preset budget")
    expected = proof_from_line(candidate, evidence, proof.line, proof.reserved_ms)
    if proof.badge == "brilliant" and expected is not None:
        survival = survival_candidate(board, evidence, proof)
        if (
            survival is None
            or proof.survival_line is None
            or not survives(survival, evidence, proof.survival_line)
        ):
            raise ValueError("Already-lost exclusion lacks checked survival evidence")
        if proof.reserved_ms < 2 * math.ceil(PRESETS[mode].search_seconds * 1000):
            raise ValueError("Missing survival search reservation")
        expected = replace(expected, survival_line=proof.survival_line)
    if (
        expected is None
        or proof != expected
        or review != replace(base, badges=(proof.badge,), proofs=(proof,))
    ):
        raise ValueError("Badge proof disagrees with engine evidence")
