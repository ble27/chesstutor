"""PRD §§8–9 quota/retention/logging policy; plan.md S7.

Pure decisions use explicit UTC clocks. Durable atomicity, restore, rollback,
load, and process cleanup remain integration gates, not mocked unit proof.
"""

from datetime import UTC, datetime, timedelta
from typing import NamedTuple, cast

import pytest

from tests.unit.future_sprints.contracts import policy
from tests.unit.future_sprints.results import AdmissionResult

NOW = datetime(2026, 11, 3, 12, tzinfo=UTC)


class Submission(NamedTuple):
    session: str
    ip: str
    mode: str
    created_at: datetime
    cache_hit: bool = False


def admission(**changes: object) -> AdmissionResult:
    arguments: dict[str, object] = {
        "session": "alice",
        "ip": "shared-ip",
        "mode": "quick",
        "now": NOW,
        "history": (),
        "active_sessions": (),
        "queued_jobs": 0,
        "cache_hit": False,
        "ip_hourly_limit": 20,
    }
    arguments.update(changes)
    return cast(AdmissionResult, policy("services.core.operations", "admit_analysis")(**arguments))


@pytest.mark.parametrize(("mode", "limit"), [("quick", 5), ("deep", 2)])
def test_per_preset_hourly_limit_has_a_retry_time(mode, limit):
    history = tuple(
        Submission("alice", "shared-ip", mode, NOW - timedelta(minutes=30)) for _ in range(limit)
    )
    allowed = admission(mode=mode, history=history[:-1])
    assert allowed.allowed is True
    blocked = admission(mode=mode, history=history)
    assert blocked.allowed is False
    assert blocked.reason == "session_quota"
    assert blocked.retry_after_seconds == 1800


@pytest.mark.parametrize(("age_seconds", "allowed"), [(3599, False), (3600, True), (3601, True)])
def test_hourly_window_boundary_is_exact(age_seconds, allowed):
    history = tuple(
        Submission("alice", "shared-ip", "quick", NOW - timedelta(seconds=age_seconds))
        for _ in range(5)
    )
    result = admission(history=history)
    assert result.allowed is allowed
    if not allowed:
        assert result.retry_after_seconds == 1


def test_cache_hits_consume_no_quota_and_require_no_queue_slot():
    history = tuple(Submission("alice", "shared-ip", "quick", NOW) for _ in range(5))
    result = admission(
        history=history,
        cache_hit=True,
        queued_jobs=50,
        active_sessions=("alice",),
        ip_hourly_limit=1,
    )
    assert result.allowed is True
    assert result.engine_quota_cost == 0


def test_historical_cache_hits_do_not_consume_future_quota():
    history = tuple(
        Submission("alice", "shared-ip", "quick", NOW, cache_hit=True) for _ in range(10)
    )
    assert admission(history=history).allowed is True


def test_deep_and_quick_session_quotas_are_independent():
    history = tuple(Submission("alice", "shared-ip", "deep", NOW) for _ in range(2))
    assert admission(history=history, mode="quick").allowed is True


def test_another_sessions_jobs_do_not_consume_this_sessions_limit():
    history = tuple(Submission("bob", "other-ip", "quick", NOW) for _ in range(5))
    assert admission(history=history).allowed is True


def test_shared_network_limit_applies_across_sessions_and_presets():
    history = (Submission("bob", "shared-ip", "deep", NOW - timedelta(minutes=10)),)
    result = admission(history=history, ip_hourly_limit=1)
    assert result.allowed is False
    assert result.reason == "ip_quota"
    assert result.retry_after_seconds == 3000


@pytest.mark.parametrize(("queued", "allowed"), [(49, True), (50, False), (51, False)])
def test_host_queue_has_fifty_job_cap(queued, allowed):
    result = admission(queued_jobs=queued)
    assert result.allowed is allowed
    if not allowed:
        assert result.reason == "queue_full"


def test_only_one_active_job_per_session():
    result = admission(active_sessions=("alice",))
    assert result.allowed is False
    assert result.reason == "session_busy"
    assert admission(active_sessions=("bob",)).allowed is True


class RetainedRecord(NamedTuple):
    id: str
    kind: str
    updated_at: datetime
    state: str
    referenced_by_active_job: bool = False


@pytest.mark.parametrize(("kind", "days"), [("game", 30), ("review", 30), ("log", 7)])
def test_retention_expires_at_the_default_boundary(kind, days):
    records = (
        RetainedRecord("old", kind, NOW - timedelta(days=days, seconds=1), "completed"),
        RetainedRecord("boundary", kind, NOW - timedelta(days=days), "completed"),
        RetainedRecord(
            "fresh", kind, NOW - timedelta(days=days) + timedelta(seconds=1), "completed"
        ),
    )
    result = policy("services.core.operations", "plan_purge")(records=records, now=NOW)
    assert set(result.delete_ids) == {"old", "boundary"}


@pytest.mark.parametrize("state", ["queued", "running", "cancel_requested"])
def test_purge_preserves_active_jobs_and_their_game_data(state):
    records = (
        RetainedRecord("active-review", "review", NOW - timedelta(days=60), state),
        RetainedRecord("active-game", "game", NOW - timedelta(days=60), "completed", True),
    )
    result = policy("services.core.operations", "plan_purge")(records=records, now=NOW)
    assert result.delete_ids == ()


def test_source_cache_expiration_uses_provider_expiry_not_game_retention():
    result = policy("services.core.operations", "source_cache_expired")(
        now=NOW,
        provider_expires_at=NOW + timedelta(seconds=30),
        fetched_at=NOW - timedelta(days=31),
    )
    assert result is False


@pytest.mark.parametrize(
    "field",
    ["question", "pgn", "raw_archive", "authorization", "cookie", "api_key", "password"],
)
def test_sensitive_fields_are_removed_from_structured_logs(field):
    event = {"event": "coach_fallback", "request_id": "req-1", field: "CANARY_PRIVATE"}
    result = policy("services.core.operations", "redact_log_event")(event=event)
    assert "CANARY_PRIVATE" not in str(result)
    assert result["event"] == "coach_fallback"
    assert result["request_id"] == "req-1"
    assert event[field] == "CANARY_PRIVATE"


def test_nested_secrets_and_url_credentials_are_redacted():
    result = policy("services.core.operations", "redact_log_event")(
        event={
            "event": "dependency_failed",
            "context": {"Authorization": "Bearer CANARY_PRIVATE"},
            "url": "postgresql://user:CANARY_PRIVATE@db/chess",
        },
    )
    assert "CANARY_PRIVATE" not in str(result)
    assert result["event"] == "dependency_failed"


@pytest.mark.parametrize(
    "event_name",
    [
        "analysis_queued",
        "analysis_completed",
        "analysis_failed",
        "cache_hit",
        "upstream_429",
        "coach_refusal",
        "coach_fallback",
    ],
)
def test_observability_keeps_safe_event_names(event_name):
    result = policy("services.core.operations", "redact_log_event")(
        event={"event": event_name, "duration_ms": 123, "question": "CANARY_PRIVATE"},
    )
    assert result["event"] == event_name
    assert result["duration_ms"] == 123
    assert "CANARY_PRIVATE" not in str(result)
