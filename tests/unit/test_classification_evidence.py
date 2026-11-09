import asyncio
from dataclasses import replace

import chess

from services.core.analysis.runner import analyse_game
from services.core.analysis.values import MoveEvidence
from services.core.classification.review import classify_evidence, summarize_evidence
from tests.unit.test_analysis_runner import FakeEngine


def evidence_fixture() -> list[MoveEvidence]:
    evidence: list[MoveEvidence] = []

    async def publish(value: MoveEvidence) -> None:
        evidence.append(value)

    async def checkpoint() -> None:
        pass

    asyncio.run(
        analyse_game(
            chess.STARTING_FEN, ("e2e4", "e7e5"), "quick", FakeEngine(), publish, checkpoint
        )
    )
    return evidence


def test_classifies_played_root_against_engine_best_and_marks_quick_provisional():
    evidence = evidence_fixture()[0]
    result = classify_evidence(evidence, "quick")
    assert result.ply == 1
    assert result.mover == "white"
    assert result.classification.base_label == "good"
    assert result.provisional is True
    assert result.badges == ()


def test_unstable_evidence_never_produces_a_confident_label():
    evidence = replace(evidence_fixture()[0], status="unstable", expected_loss=None)
    result = classify_evidence(evidence, "deep")
    assert result.classification.base_label == "unclassified"
    assert result.provisional is False


def test_partial_review_reports_coverage_without_final_summary():
    evidence = evidence_fixture()[:1]
    result = summarize_evidence(evidence, "quick", "running", 2)
    assert result.coverage.analyzed_plies == 1
    assert result.coverage.total_plies == 2
    assert result.is_final is False
    assert not result.critical_moments


def test_analysis_response_exposes_labels_and_partial_coverage():
    from datetime import UTC, datetime
    from uuid import uuid4

    from services.adapters.analysis_records import StoredJob
    from tests.browser_fixture_app import game

    evidence = evidence_fixture()[:1]
    now = datetime.now(UTC)
    job = StoredJob(
        id=uuid4(),
        game_id=game.game.id,
        owner="owner",
        ip_digest="ip",
        cache_key="key",
        mode="quick",
        state="running",
        game_data=game,
        engine={"classification_version": "v2"},
        token=uuid4(),
        attempts=1,
        completed_plies=1,
        total_plies=2,
        dispatch_pending=False,
        created_at=now,
        updated_at=now,
        heartbeat=now,
        deadline_at=None,
        error_code=None,
    )
    response = job.response("owner", evidence).model_dump(mode="json")
    assert response["classifications"][0]["classification"]["base_label"] == "good"
    assert response["classifications"][0]["provisional"] is True
    assert response["summary"]["coverage"]["analyzed_plies"] == 1
    assert response["summary"]["is_final"] is False
    legacy = job.model_copy(update={"engine": {"classification_version": "pending-v1"}})
    old_response = legacy.response("owner", evidence)
    assert old_response.classifications == []
    assert old_response.summary is None


def test_legacy_engine_identity_remains_usable_without_crossing_other_versions():
    from services.worker.analysis import compatible_engine_identity

    current = {"binary_sha256": "trusted", "classification_version": "v2"}
    old = {**current, "classification_version": "pending-v1"}
    assert compatible_engine_identity(current, old)
    assert compatible_engine_identity(current, current)
    assert not compatible_engine_identity(current, {**old, "binary_sha256": "different"})
    assert not compatible_engine_identity(current, {**current, "classification_version": "other"})


def test_analysis_response_work_runs_off_the_async_request_thread():
    from threading import get_ident
    from uuid import uuid4

    from services.application.analysis import AnalysisService

    class Job:
        owner = "owner"
        state = "completed"

        def response(self, owner: str, evidence: list[MoveEvidence]) -> int:
            return get_ident()

    class Store:
        def get(self, identifier):
            return job

        def snapshot(self, identifier):
            return job, []

    job = Job()
    service = AnalysisService(Store(), None, {})
    request_thread = get_ident()
    assert asyncio.run(service.read(uuid4(), "owner")) != request_thread
