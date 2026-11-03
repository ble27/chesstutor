from copy import deepcopy

from fastapi.testclient import TestClient

from tests.browser_fixture_app import app, game


def payload():
    line = {
        "score": {"kind": "cp", "value": 20},
        "wdl": [10, 980, 10],
        "depth": 12,
        "nodes": 30000,
        "time_ms": 40,
        "pv": ["e2e4"],
        "bounded": False,
    }
    return {
        "game_version": 1,
        "pgn_hash": "a" * 64,
        "positions": [{"ply": 1, "best": line, "played": deepcopy(line)}],
    }


def test_client_evidence_is_legally_normalized_without_becoming_server_verified():
    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/games/{game.game.id}/browser-evidence",
            json=payload(),
            headers={"Origin": "http://127.0.0.1:5174"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["trust"] == "client_unverified"
        result = response.json()["evidence"][0]
        assert result["played"]["pv"][0]["san"] == "e4"
        assert result["root_fen"] == game.initial_fen
        assert result["played"]["score"]["pov"] == "white"


def test_client_illegal_pv_wrong_game_origin_and_oversized_requests_are_rejected():
    with TestClient(app) as client:
        path = f"/api/v1/games/{game.game.id}/browser-evidence"
        headers = {"Origin": "http://127.0.0.1:5174"}
        data = payload()
        data["positions"][0]["played"]["pv"] = ["a1a8"]
        assert client.post(path, json=data, headers=headers).status_code == 422
        data = payload()
        data["game_version"] = 2
        assert client.post(path, json=data, headers=headers).status_code == 409
        assert client.post(path, json=payload()).status_code == 403
        assert client.post(path, content=b"x" * 65537, headers=headers).status_code == 413


def test_distinct_best_and_played_lines_are_validated_from_the_same_root():
    data = payload()
    data["positions"][0]["best"]["pv"] = ["d2d4"]
    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/games/{game.game.id}/browser-evidence",
            json=data,
            headers={"Origin": "http://127.0.0.1:5174"},
        )
    assert response.status_code == 200
    result = response.json()["evidence"][0]
    assert result["best"][0]["pv"][0]["san"] == "d4"
    assert result["played"]["pv"][0]["san"] == "e4"
    assert result["root_fen"] == game.initial_fen
