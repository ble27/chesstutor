from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.settings import Settings
from tests.unit.analysis_fakes import Service
from tests.unit.test_health import FakeProbe


@pytest.mark.parametrize(
    "origin", [None, "null", "https://evil.example", "http://localhost:5173.evil.example"]
)
def test_analysis_mutations_require_an_exact_trusted_origin(origin):
    service = Service()
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
    ) as client:
        headers = {} if origin is None else {"Origin": origin}
        response = client.post(
            "/api/v1/analyses",
            json={"game_id": str(service.game_id), "mode": "quick"},
            headers=headers,
        )
        assert response.status_code == 403
        assert response.json()["code"] == "invalid_origin"
    assert service.calls == []


def test_signed_http_only_session_cannot_be_forged_for_cancellation():
    service = Service()
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
    ) as client:
        headers = {"Origin": "http://localhost:5173"}
        challenge = client.post(
            "/api/v1/analyses",
            json={"game_id": str(service.game_id), "mode": "quick"},
            headers=headers,
        )
        assert challenge.status_code == 409
        submitted = client.post(
            "/api/v1/analyses",
            json={"game_id": str(service.game_id), "mode": "quick"},
            headers=headers,
        )
        cookie = submitted.headers["set-cookie"]
        assert "HttpOnly" in cookie and "SameSite=lax" in cookie
        assert "Path=/api/v1" in cookie
        owner = service.owner
        client.cookies.clear()
        client.cookies.set("chess_session", owner + ".9999999999." + "0" * 64)
        denied = client.post(f"/api/v1/analyses/{service.id}/cancel", headers=headers)
        assert denied.status_code == 403


@pytest.mark.parametrize(
    "payload",
    [
        {"mode": "custom", "game_id": str(uuid4())},
        {"mode": "quick", "game_id": str(uuid4()), "threads": 99},
        {"mode": "deep", "game_id": "https://evil.example/game"},
    ],
)
def test_only_bounded_server_presets_and_imported_game_ids_are_accepted(payload):
    service = Service()
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
    ) as client:
        response = client.post(
            "/api/v1/analyses", json=payload, headers={"Origin": "http://localhost:5173"}
        )
        assert response.status_code == 422
    assert service.calls == []


def test_analysis_body_is_bounded_before_json_parsing():
    service = Service()
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
    ) as client:
        response = client.post(
            "/api/v1/analyses", content=b"x" * 4097, headers={"Origin": "http://localhost:5173"}
        )
        assert response.status_code == 413
        assert response.json()["request_id"] == response.headers["x-request-id"]
    assert service.calls == []


def test_initial_submission_establishes_session_before_allocating_work():
    service = Service()
    with TestClient(
        create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
    ) as client:
        payload = {"game_id": str(service.game_id), "mode": "quick"}
        headers = {"Origin": "http://localhost:5173"}
        challenge = client.post("/api/v1/analyses", json=payload, headers=headers)
        assert challenge.status_code == 409
        assert challenge.json()["code"] == "session_required"
        assert "HttpOnly" in challenge.headers["set-cookie"]
        assert service.calls == []
        accepted = client.post("/api/v1/analyses", json=payload, headers=headers)
        assert accepted.status_code == 202
        assert len(service.calls) == 1


@pytest.mark.parametrize("signature", [b"\xe9", b"z" * 64, b"0" * 65])
def test_malformed_cookie_signature_does_not_crash_http_boundary(signature):
    import asyncio

    import httpx

    async def scenario():
        service = Service()
        app = create_app(Settings(_env_file=None), FakeProbe(True), analysis=service)
        cookie = b"chess_session=" + b"a" * 32 + b".9999999999." + signature
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/analyses",
                json={"game_id": str(service.game_id), "mode": "quick"},
                headers=[(b"cookie", cookie), (b"origin", b"http://localhost:5173")],
            )
            assert response.status_code == 409
            assert response.json()["code"] == "session_required"
            assert service.calls == []

    asyncio.run(scenario())
