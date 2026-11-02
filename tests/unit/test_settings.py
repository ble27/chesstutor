import pytest
from pydantic import ValidationError

from services.api.app.settings import Settings


@pytest.fixture(autouse=True)
def clear_config(monkeypatch: pytest.MonkeyPatch) -> None:
    import os

    for key in os.environ:
        if key.startswith("CHESS_"):
            monkeypatch.delenv(key)


def test_defaults_are_local_and_secrets_are_redacted() -> None:
    settings = Settings(_env_file=None)
    assert settings.environment == "development"
    assert settings.dependency_timeout_seconds == 2
    assert "127.0.0.1:5433" in settings.database_url.get_secret_value()
    assert "local-development" not in repr(settings)


@pytest.mark.parametrize(
    "name,value",
    [
        ("CHESS_DATABASE_URL", "sqlite:///local.db"),
        ("CHESS_REDIS_URL", "https://example.com"),
        ("CHESS_ALLOWED_ORIGINS", '["*"]'),
        ("CHESS_ALLOWED_ORIGINS", '["https://example.com/path"]'),
        ("CHESS_ALLOWED_ORIGINS", '["https://user:password@example.com"]'),
        ("CHESS_DEPENDENCY_TIMEOUT_SECONDS", "0"),
        ("CHESS_DEPENDENCY_TIMEOUT_SECONDS", "6"),
        ("CHESS_ENVIRONMENT", "unknown"),
    ],
)
def test_invalid_configuration_fails(
    monkeypatch: pytest.MonkeyPatch, name: str, value: str
) -> None:
    monkeypatch.setenv(name, value)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_production_rejects_local_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHESS_ENVIRONMENT", "production")
    with pytest.raises(ValidationError, match="explicit database credentials"):
        Settings(_env_file=None)


def test_explicit_production_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHESS_ENVIRONMENT", "production")
    monkeypatch.setenv("CHESS_DATABASE_URL", "postgresql://app:secret@database/chess")
    monkeypatch.setenv("CHESS_ALLOWED_ORIGINS", '["https://chess.example"]')
    assert Settings(_env_file=None).allowed_origins == ("https://chess.example",)
