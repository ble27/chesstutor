from fastapi.testclient import TestClient

from tests.browser_fixture_app import app, game
from tests.unit.test_browser_evidence_http import payload

HEADERS = {"Origin": "http://127.0.0.1:5174"}


def test_sandbox_requires_session_origin_and_preserves_legal_history() -> None:
    path = f"/api/v1/games/{game.game.id}/sandbox"
    body = {"game_version": 1, "pgn_hash": "a" * 64, "root_ply": 1, "branch": ["e7e5"]}
    with TestClient(app) as client:
        assert client.post(path, json=body).status_code == 403
        assert client.post(path, json=body, headers=HEADERS).status_code == 409
        response = client.post(path, json=body, headers=HEADERS)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["moves"] == ["e2e4", "e7e5"]
        assert "g1f3" in data["legal_moves"]
        assert data["trust"] == "client_unverified"
        assert (
            client.post(path, json={**body, "branch": ["e2e5"]}, headers=HEADERS).status_code == 422
        )
        assert (
            client.post(path, json={**body, "game_version": 2}, headers=HEADERS).status_code == 409
        )
        assert client.post(path, content=b"x" * 16385, headers=HEADERS).status_code == 413


def test_sandbox_validates_live_lines_at_branch_root() -> None:
    path = f"/api/v1/games/{game.game.id}/sandbox"
    line = payload()["positions"][0]["best"]
    body = {"game_version": 1, "pgn_hash": "a" * 64, "root_ply": 0, "branch": [], "line": line}
    with TestClient(app) as client:
        client.post(path, json=body, headers=HEADERS)
        response = client.post(path, json=body, headers=HEADERS)
        assert response.status_code == 200, response.text
        assert response.json()["line"]["pv"][0]["san"] == "e4"
        line["pv"] = ["a1a8"]
        assert client.post(path, json=body, headers=HEADERS).status_code == 422


def test_sandbox_validates_both_ranked_lines_and_rejects_bad_pairs() -> None:
    path = f"/api/v1/games/{game.game.id}/sandbox"
    best = payload()["positions"][0]["best"]
    alternative = {**best, "pv": ["d2d4"]}
    body = {"game_version": 1, "pgn_hash": "a" * 64, "root_ply": 0, "branch": []}
    with TestClient(app) as client:
        client.post(path, json=body, headers=HEADERS)
        response = client.post(path, json={**body, "lines": [best, alternative]}, headers=HEADERS)
        assert response.status_code == 200
        assert [item["pv"][0]["san"] for item in response.json()["lines"]] == ["e4", "d4"]
        for invalid in (
            [best, best],
            [best, {**alternative, "pv": ["a1a8"]}],
            [best, {**alternative, "depth": best["depth"] + 1}],
        ):
            assert (
                client.post(path, json={**body, "lines": invalid}, headers=HEADERS).status_code
                == 422
            )
