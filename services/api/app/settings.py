from pathlib import Path
from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CHESS_", env_file=".env", extra="ignore", frozen=True
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr = SecretStr(
        "postgresql://chess:local-development@127.0.0.1:5433/chesstutor"
    )
    redis_url: SecretStr = SecretStr("redis://127.0.0.1:6380/0")
    allowed_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    pubapi_user_agent: str | None = Field(
        default=None, min_length=10, max_length=300, pattern=r"^[\x20-\x7e]+$"
    )
    dependency_timeout_seconds: float = Field(default=2, ge=0.1, le=5)
    session_secret: SecretStr = SecretStr("local-development-session-key-change-before-hosting")
    analysis_ip_jobs_per_hour: int = Field(default=20, ge=1, le=10000)
    engine_path: Path = Path("bin/stockfish")
    engine_platform: Literal["darwin-arm64", "linux-x86_64"] | None = None

    @field_validator("pubapi_user_agent", mode="before")
    @classmethod
    def empty_user_agent(cls, value: object) -> object:
        return None if value == "" else value

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr) -> SecretStr:
        parsed = urlsplit(value.get_secret_value())
        if parsed.scheme not in {"postgresql", "postgres"} or not parsed.hostname:
            raise ValueError("A PostgreSQL URL with a host is required")
        return value

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: SecretStr) -> SecretStr:
        parsed = urlsplit(value.get_secret_value())
        if parsed.scheme not in {"redis", "rediss"} or not parsed.hostname:
            raise ValueError("A Redis URL with a host is required")
        return value

    @field_validator("allowed_origins")
    @classmethod
    def validate_origins(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        for value in values:
            parsed = urlsplit(value)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError("CORS entries must be explicit HTTP origins without paths")
        return values

    @model_validator(mode="after")
    def validate_production(self) -> Self:
        if self.environment == "production":
            if "local-development" in self.database_url.get_secret_value():
                raise ValueError("Production requires explicit database credentials")
            if any(not origin.startswith("https://") for origin in self.allowed_origins):
                raise ValueError("Production origins must use HTTPS")
            secret = self.session_secret.get_secret_value()
            if len(secret) < 32 or secret.startswith("local-development"):
                raise ValueError(
                    "Production requires a private session signing key of at least 32 characters"
                )
        return self
