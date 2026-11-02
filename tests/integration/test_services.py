import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.settings import Settings


@pytest.mark.integration
def test_real_postgres_and_redis_readiness() -> None:
    with TestClient(create_app(Settings())) as client:
        response = client.get("/api/v1/health/ready")
    assert response.status_code == 200, response.text
    assert response.json() == {"status": "ready"}
