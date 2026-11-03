from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.settings import Settings
from tests.unit.analysis_fakes import Service


class FakeProbe:
    def __init__(self, available: bool) -> None:
        self.available = available
        self.calls = 0

    async def check(self) -> bool:
        self.calls += 1
        return self.available


def test_liveness_is_independent_of_dependencies() -> None:
    probe = FakeProbe(False)
    with TestClient(create_app(Settings(_env_file=None), probe, analysis=Service())) as client:
        response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert UUID(response.headers["X-Request-ID"])
    assert probe.calls == 0


@pytest.mark.parametrize("available", [True, False])
def test_readiness_reflects_dependencies(available: bool) -> None:
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(available), analysis=Service())
    ) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == (200 if available else 503)
    if available:
        assert response.json() == {"status": "ready"}
    else:
        error = response.json()
        assert error["code"] == "dependencies_unavailable"
        assert error["retryable"] is True
        assert error["request_id"] == response.headers["X-Request-ID"]


def test_not_found_uses_safe_error_envelope() -> None:
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=Service())
    ) as client:
        response = client.get("/not-a-route?secret=do-not-echo")
    assert response.status_code == 404
    assert response.json()["message"] == "Resource not found"
    assert "do-not-echo" not in response.text


def test_cors_allows_only_configured_origins() -> None:
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=Service())
    ) as client:
        allowed = client.get("/api/v1/health/live", headers={"Origin": "http://localhost:5173"})
        blocked = client.get("/api/v1/health/live", headers={"Origin": "https://untrusted.example"})
    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in blocked.headers


def test_unexpected_errors_do_not_expose_dependency_details() -> None:
    class BrokenProbe:
        async def check(self) -> bool:
            raise RuntimeError("database-password-private")

    with TestClient(
        create_app(Settings(_env_file=None), BrokenProbe(), analysis=Service()),
        raise_server_exceptions=False,
    ) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 500
    assert response.json()["code"] == "internal_error"
    assert response.json()["request_id"] == response.headers["X-Request-ID"]
    assert "database-password-private" not in response.text
