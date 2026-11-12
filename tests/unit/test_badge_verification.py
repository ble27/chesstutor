import asyncio
from collections.abc import Sequence

import chess

from services.core.analysis.runner import Checkpoint
from services.core.analysis.values import (
    CentipawnScore,
    EngineLine,
    MateScore,
    MoveEvidence,
    VariationMove,
    Wdl,
)
from services.core.classification.review import ReviewedMove
from services.core.classification.verification import verify_move


def line(
    board: chess.Board, moves: Sequence[str], expected_wins: int, mate: int | None = None
) -> EngineLine:
    root = board.copy()
    steps: list[VariationMove] = []
    for uci in moves:
        move = root.parse_uci(uci)
        san = root.san(move)
        root.push(move)
        steps.append(VariationMove(uci, san, root.fen()))
    mover = "white" if board.turn else "black"
    score = (
        CentipawnScore(100, "white")
        if mate is None
        else MateScore(mate if board.turn else -mate, "white")
    )
    mover_score = CentipawnScore(100, mover) if mate is None else MateScore(mate, mover)
    return EngineLine(
        score,
        mover_score,
        Wdl(expected_wins, 0, 1000 - expected_wins, mover),
        12,
        5000,
        750,
        tuple(steps),
    )


def evidence(board: chess.Board, best: tuple[EngineLine, ...], played: EngineLine) -> MoveEvidence:
    mover = "white" if board.turn else "black"
    assert best[0].wdl is not None and played.wdl is not None
    loss = max(0.0, float(best[0].wdl.expected() - played.wdl.expected()))
    return MoveEvidence(
        1, 0, board.fen(), mover, played.pv[0].uci, best, played, "usable", loss, False, None, None
    )


class FakeVerifier:
    def __init__(self, result: EngineLine) -> None:
        self.result = result
        self.calls: list[tuple[str, float, int, tuple[chess.Move, ...] | None]] = []

    async def search(
        self,
        board: chess.Board,
        seconds: float,
        multipv: int,
        root_moves: tuple[chess.Move, ...] | None,
        checkpoint: Checkpoint,
    ) -> tuple[EngineLine, ...]:
        await checkpoint()
        self.calls.append((board.fen(), seconds, multipv, root_moves))
        return (self.result,)


async def checkpoint() -> None:
    pass


def verify(
    board: chess.Board, item: MoveEvidence, engine: FakeVerifier, allowed: bool = True
) -> tuple[ReviewedMove, list[int]]:
    reservations: list[int] = []

    async def reserve(cost_ms: int) -> bool:
        reservations.append(cost_ms)
        return allowed

    result = asyncio.run(
        verify_move(board, item, "deep", engine, reserve, checkpoint, deadline=10**12)
    )
    return result, reservations


def test_great_rechecks_runner_up_with_the_same_root_and_deep_search_budget():
    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)
    engine = FakeVerifier(runner)
    result, reservations = verify(board, evidence(board, (best, runner), best), engine)
    assert result.badges == ("great",)
    assert result.proofs[0].line == runner
    assert engine.calls[0][0] == board.fen()
    assert engine.calls[0][1:3] == (0.75, 1)
    assert engine.calls[0][3] == (chess.Move.from_uci("d2d4"),)
    assert reservations and reservations[0] >= 750


def test_exhausted_budget_does_not_start_a_search_or_award_a_badge():
    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)
    engine = FakeVerifier(runner)
    result, _ = verify(board, evidence(board, (best, runner), best), engine, allowed=False)
    assert result.badges == ()
    assert engine.calls == []


def test_miss_has_a_verified_legal_forced_mate_and_an_abandoned_opportunity():
    board = chess.Board()
    for uci in ("f2f3", "e7e5", "g2g4"):
        board.push_uci(uci)
    mate, played = line(board, ("d8h4",), 1000, mate=1), line(board, ("b8c6",), 500)
    result, _ = verify(board, evidence(board, (mate,), played), FakeVerifier(mate))
    assert result.badges == ("miss",)
    assert result.proofs[0].motif == "forced_mate"
    assert result.themes == ("mate_threat",)


def test_brilliant_checks_an_accepting_reply_and_six_subsequent_plies():
    board = chess.Board()
    opening = "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Bd3 Nc6"
    for san in opening.split():
        board.push_san(san)
    continuation = ("d3h7", "g8h7", "f3g5", "h7g8", "d1h5", "f8e8", "h5h7")
    played = line(board, continuation, 800)
    reply_board = board.copy()
    reply_board.push_uci("d3h7")
    reply = line(reply_board, continuation[1:], 200)
    survival = line(board, ("d3e2", "c5c4", "e1g1", "a7a6", "f1e1", "a6a5"), 800)

    class SurvivalVerifier(FakeVerifier):
        async def search(self, board, seconds, multipv, root_moves, checkpoint):
            await super().search(board, seconds, multipv, root_moves, checkpoint)
            return (reply,) if len(self.calls) == 1 else (survival,)

    engine = SurvivalVerifier(reply)
    result, _ = verify(board, evidence(board, (played,), played), engine)
    assert result.badges == ("brilliant",)
    assert result.proofs[0].offered_material_points >= 2
    assert result.proofs[0].verified_followup_plies >= 6
    assert result.proofs[0].expected_score_after_reply >= 0.5
    assert engine.calls[0][0] == reply_board.fen()
    assert result.proofs[0].survival_line == survival
    assert engine.calls[1][0] == board.fen()


def test_quick_never_awards_a_positive_badge_or_runs_its_verification():
    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)
    engine = FakeVerifier(runner)

    async def reserve(cost_ms: int) -> bool:
        raise AssertionError("Quick positive badge must not reserve budget")

    result = asyncio.run(
        verify_move(
            board,
            evidence(board, (best, runner), best),
            "quick",
            engine,
            reserve,
            checkpoint,
            deadline=10**12,
        )
    )
    assert not result.badges and not engine.calls


def test_invalid_or_unstable_verification_cannot_authorize_great():
    from dataclasses import replace

    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)
    item = evidence(board, (best, runner), best)
    for unverified in (
        replace(runner, bounded=True),
        replace(runner, wdl=None),
        replace(runner, pv=(replace(runner.pv[0], fen=board.fen()),)),
    ):
        result, _ = verify(board, item, FakeVerifier(unverified))
        assert result.badges == ()
        assert result.proofs == ()


def test_a_better_third_candidate_prevents_great_even_if_second_line_looks_unique():
    board = chess.Board()
    best = line(board, ("e2e4",), 800)
    second, third = line(board, ("d2d4",), 500), line(board, ("g1f3",), 700)
    engine = FakeVerifier(second)
    result, _ = verify(board, evidence(board, (best, second, third), best), engine)
    assert result.badges == ()
    assert not engine.calls


def test_deadline_exhaustion_never_reserves_or_awards_a_badge():
    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)

    async def reserve(cost_ms: int) -> bool:
        raise AssertionError("Expired deadline must not reserve work")

    engine = FakeVerifier(runner)
    result = asyncio.run(
        verify_move(
            board,
            evidence(board, (best, runner), best),
            "deep",
            engine,
            reserve,
            checkpoint,
            deadline=0,
        )
    )
    assert result.badges == ()
    assert not engine.calls


def test_miss_is_withheld_when_recheck_no_longer_beats_the_played_move():
    from dataclasses import replace

    board = chess.Board()
    for uci in ("f2f3", "e7e5", "g2g4"):
        board.push_uci(uci)
    mate, played = line(board, ("d8h4",), 1000, mate=1), line(board, ("e8e7",), 500)
    failed_recheck = replace(mate, wdl=Wdl(400, 0, 600, "black"))
    result, _ = verify(board, evidence(board, (mate,), played), FakeVerifier(failed_recheck))
    assert result.badges == ()


def test_cooperative_material_gain_is_not_a_verified_missed_tactic():
    board = chess.Board()
    cooperative = line(board, ("e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "d8h4", "f3h4"), 800)
    played = line(board, ("a2a3",), 500)
    engine = FakeVerifier(cooperative)
    result, _ = verify(board, evidence(board, (cooperative,), played), engine)
    assert result.badges == ()
    assert engine.calls == []


def test_invalid_optional_search_output_omits_the_badge_without_losing_base_review():
    board = chess.Board()
    best, runner = line(board, ("e2e4",), 800), line(board, ("d2d4",), 500)

    class InvalidVerifier(FakeVerifier):
        async def search(self, board, seconds, multipv, root_moves, checkpoint):
            raise ValueError("Invalid optional PV")

    result, _ = verify(board, evidence(board, (best, runner), best), InvalidVerifier(runner))
    assert result.classification.base_label == "best"
    assert result.badges == ()


def test_brilliant_verifies_the_strongest_reply_without_restricting_it_to_captures():
    board = chess.Board()
    opening = "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Bd3 Nc6"
    for san in opening.split():
        board.push_san(san)
    played = line(board, ("d3h7", "g8h8"), 800)
    after = board.copy()
    after.push_uci("d3h7")
    engine = FakeVerifier(line(after, ("g8h8",), 200))
    result, _ = verify(board, evidence(board, (played,), played), engine)
    assert result.badges == ()
    assert engine.calls[0][3] is None


def test_failed_brilliant_can_fall_back_to_verified_great_with_remaining_budget():
    board = chess.Board()
    opening = "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Bd3 Nc6"
    for san in opening.split():
        board.push_san(san)
    played = line(board, ("d3h7", "g8h8"), 800)
    runner = line(board, ("d1e2",), 500)
    after = board.copy()
    after.push_uci("d3h7")

    class TwoSearches(FakeVerifier):
        async def search(self, board, seconds, multipv, root_moves, checkpoint):
            await super().search(board, seconds, multipv, root_moves, checkpoint)
            return (self.result,) if len(self.calls) == 1 else (runner,)

    engine = TwoSearches(line(after, ("g8h8",), 200))
    result, reservations = verify(board, evidence(board, (played, runner), played), engine)
    assert result.badges == ("great",)
    assert len(reservations) == len(engine.calls) == 2
    assert engine.calls[0][3] is None
    assert engine.calls[1][3] == (chess.Move.from_uci("d1e2"),)


def test_material_captured_on_the_last_ply_is_not_proved_safe_from_recapture():
    board = chess.Board("5Q2/1r6/1b6/4K3/8/4k3/1R6/8 w - - 0 1")
    from services.core.classification.tactics import winning_motif

    cooperative = line(board, ("f8f4", "e3d3", "f4e4", "d3c3", "e4b4", "c3d3", "b4b6"), 800)
    assert winning_motif(board, cooperative) is None


def test_missing_pre_move_survivability_withholds_brilliant():
    board = chess.Board()
    opening = "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5 Bd3 Nc6"
    for san in opening.split():
        board.push_san(san)
    continuation = ("d3h7", "g8h7", "f3g5", "h7g8", "d1h5", "f8e8", "h5h7")
    played = line(board, continuation, 800)
    after = board.copy()
    after.push_uci("d3h7")
    # Returning the capture-root line for the pre-move survival search is not
    # proof that the offered bishop had a safe alternative before the sacrifice.
    result, _ = verify(
        board, evidence(board, (played,), played), FakeVerifier(line(after, continuation[1:], 200))
    )
    assert result.badges == ()


def test_verification_reserves_the_engine_cleanup_bound_before_starting_search():
    from dataclasses import dataclass

    @dataclass
    class Clock:
        seconds: float = 0

        def now(self) -> float:
            return self.seconds

    clock = Clock()
    board = chess.Board()
    for uci in ("f2f3", "e7e5", "g2g4"):
        board.push_uci(uci)
    mate, played = line(board, ("d8h4",), 1000, mate=1), line(board, ("e8e7",), 500)
    reservations: list[int] = []

    class SlowStop(FakeVerifier):
        async def search(self, board, seconds, multipv, root_moves, checkpoint):
            try:
                await asyncio.Event().wait()
            finally:
                # Simulated 200ms search timeout plus 400ms stop/cleanup.
                clock.seconds += 0.6

    async def reserve(cost_ms: int) -> bool:
        reservations.append(cost_ms)
        return True

    result = asyncio.run(
        verify_move(
            board,
            evidence(board, (mate,), played),
            "quick",
            SlowStop(mate),
            reserve,
            checkpoint,
            deadline=100,
            now=clock.now,
        )
    )
    assert result.badges == ()
    assert reservations == [1200]
    assert clock.seconds * 1000 < reservations[0]


FREE_PAWN = "4k3/8/8/3p4/8/2N5/8/4K3 w - - 0 1"
DEFENDED_PAWN = "4k3/8/4p3/3p4/8/2N5/8/4K3 w - - 0 1"


def missed_capture(fen: str) -> tuple[chess.Board, MoveEvidence, EngineLine]:
    board = chess.Board(fen)
    best, played = line(board, ("c3d5",), 800), line(board, ("e1e2",), 500)
    return board, evidence(board, (best,), played), best


def test_ignoring_a_free_pawn_is_a_miss():
    board, item, best = missed_capture(FREE_PAWN)
    result, _ = verify(board, item, FakeVerifier(best))
    assert result.badges == ("miss",)
    assert result.proofs[0].motif == "material_win"


def test_a_defended_pawn_is_not_a_missed_capture():
    board, item, best = missed_capture(DEFENDED_PAWN)
    result, _ = verify(board, item, FakeVerifier(best))
    assert result.badges == ()


def test_taking_the_same_piece_another_way_is_not_a_miss():
    """Regression: review sheet row 7; Nxd4 won the same bishop as cxd4."""
    board = chess.Board("4k3/8/2n5/2p5/3B4/8/8/4K3 b - - 0 1")
    pawn_takes, knight_takes = line(board, ("c5d4",), 800), line(board, ("c6d4",), 500)
    result, _ = verify(
        board, evidence(board, (pawn_takes,), knight_takes), FakeVerifier(pawn_takes)
    )
    assert result.badges == ()
