from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import select

from services.adapters.analysis_tables import reviews
from services.core.analysis.runner import AnalysisCancelled
from tests.integration.analysis_fixtures import analysis_fixture
from tests.integration.test_analysis_recovery import sample_evidence


@pytest.mark.integration
def test_versioned_move_reviews_are_persisted_atomically_with_engine_evidence():
    with analysis_fixture() as (store, queued):
        job = store.claim(queued.id, queued.token, queued.created_at)
        value = sample_evidence(job)[0]
        store.save_ply(job.id, job.token, value, queued.created_at)
        snapshot, evidence = store.snapshot(job.id)
        with store.engine.connect() as connection:
            persisted = connection.scalar(
                select(reviews.c.move_review).where(reviews.c.analysis_id == job.id)
            )
        assert persisted["ply"] == value.ply
        assert persisted["classification"]["policy_version"] == "v3"
        assert snapshot.response(job.owner, evidence).classifications[0].ply == value.ply


@pytest.mark.integration
def test_verification_budget_is_durable_and_old_attempts_cannot_spend_it():
    with analysis_fixture("deep") as (store, queued):
        job = store.claim(queued.id, queued.token, queued.created_at)
        # Only work already performed supplies budget. A single 750ms verification
        # needs at least 5000ms of prior base search; reservations survive a crash.
        assert not store.reserve_verification(job.id, job.token, 1, 750, 1500, queued.created_at)
        for value in sample_evidence(job)[:3]:
            value = replace(
                value,
                best=tuple(replace(line, time_ms=750) for line in value.best),
                played=replace(value.played, time_ms=750),
            )
            store.save_ply(job.id, job.token, value, queued.created_at)
        assert store.reserve_verification(job.id, job.token, 4, 750, 1500, queued.created_at)
        assert not store.reserve_verification(job.id, job.token, 4, 151, 1500, queued.created_at)
        store.recover(queued.created_at + timedelta(seconds=31))
        recovered = store.get(job.id)
        assert recovered.verification_reserved_ms == 750
        with pytest.raises(AnalysisCancelled):
            store.reserve_verification(job.id, job.token, 1, 1, 10000, queued.created_at)


@pytest.mark.integration
def test_classification_migration_rolls_back_without_losing_engine_evidence():
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect

    with analysis_fixture() as (store, queued):
        store.claim(queued.id, queued.token, queued.created_at)
        value = sample_evidence(queued)[0]
        store.save_ply(queued.id, queued.token, value, queued.created_at)
        try:
            command.downgrade(Config("alembic.ini"), "0002")
            assert "move_review" not in {
                column["name"] for column in inspect(store.engine).get_columns("analysis_evidence")
            }
            with store.engine.connect() as connection:
                assert (
                    connection.scalar(
                        select(reviews.c.payload).where(reviews.c.analysis_id == queued.id)
                    )["ply"]
                    == 1
                )
        finally:
            command.upgrade(Config("alembic.ini"), "head")


@pytest.mark.integration
def test_conflicting_review_retry_cannot_replace_the_first_persisted_result():
    import asyncio

    import chess

    from services.core.classification.review import classify_evidence
    from services.core.classification.verification import verify_move
    from tests.unit.test_badge_verification import FakeVerifier, checkpoint, evidence, line

    with analysis_fixture(
        "deep", pgn='[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0'
    ) as (store, queued):
        job = store.claim(queued.id, queued.token, queued.created_at)
        board = chess.Board(job.game_data.initial_fen)
        for value in sample_evidence(job)[:9]:
            store.save_ply(
                job.id,
                job.token,
                replace(
                    value,
                    best=tuple(replace(item, time_ms=750) for item in value.best),
                    played=replace(value.played, time_ms=750),
                ),
                queued.created_at,
            )
            board.push_uci(value.played_uci)
        best, runner = line(board, ("f8e7",), 800), line(board, ("b7b5",), 500)
        item = replace(evidence(board, (best, runner), best), ply=10, before_ply=9)

        async def reserve(cost_ms: int) -> bool:
            return store.reserve_verification(
                job.id, job.token, 10, cost_ms, 1500, queued.created_at
            )

        verified = asyncio.run(
            verify_move(
                board, item, "deep", FakeVerifier(runner), reserve, checkpoint, deadline=10**12
            )
        )
        assert verified.badges == ("great",)
        store.save_ply(job.id, job.token, item, queued.created_at, classify_evidence(item, "deep"))
        with pytest.raises(ValueError, match="Conflicting retry of a review"):
            store.save_ply(job.id, job.token, item, queued.created_at, verified)
        snapshot, values = store.snapshot(job.id)
        assert snapshot.response(job.owner, values).classifications[-1].badges == ()
