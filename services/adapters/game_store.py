import hashlib
from typing import Protocol
from uuid import UUID

from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.engine import Engine

from services.api.app.game_schemas import GameResponse
from services.core.games.discovery import DiscoveryError

metadata = MetaData()
sources = Table(
    "game_sources",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True),
    Column("payload", JSONB, nullable=False),
)
games = Table(
    "games",
    metadata,
    Column("id", PG_UUID(as_uuid=True), primary_key=True),
    Column("version", Integer, primary_key=True),
    Column("pgn_hash", String(64), nullable=False),
    Column("pgn", String, nullable=False),
    Column("payload", JSONB, nullable=False),
)


class GameStore(Protocol):
    def stage(self, records: list[tuple[UUID, dict[str, object]]]) -> None: ...
    def source(self, game_id: UUID) -> dict[str, object] | None: ...
    def latest(self, game_id: UUID) -> GameResponse | None: ...
    def save(self, game: GameResponse, pgn: str) -> GameResponse: ...
    def close(self) -> None: ...


class PostgresGameStore:
    def __init__(self, database_url: str) -> None:
        url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
        self.engine: Engine = create_engine(
            url,
            pool_size=3,
            max_overflow=0,
            pool_timeout=3,
            connect_args={"connect_timeout": 3, "options": "-c statement_timeout=5000"},
        )

    def stage(self, records: list[tuple[UUID, dict[str, object]]]) -> None:
        if not records:
            return
        # Stable order prevents lock inversion when concurrent months overlap.
        records = sorted(dict(records).items(), key=lambda record: str(record[0]))
        with self.engine.begin() as connection:
            statement = insert(sources).values(
                [{"id": key, "payload": value} for key, value in records]
            )
            connection.execute(
                statement.on_conflict_do_update(
                    index_elements=[sources.c.id], set_={"payload": statement.excluded.payload}
                )
            )

    def source(self, game_id: UUID) -> dict[str, object] | None:
        with self.engine.connect() as connection:
            value = connection.scalar(select(sources.c.payload).where(sources.c.id == game_id))
            return dict(value) if value is not None else None

    def latest(self, game_id: UUID) -> GameResponse | None:
        with self.engine.connect() as connection:
            value = connection.scalar(
                select(games.c.payload)
                .where(games.c.id == game_id)
                .order_by(games.c.version.desc())
                .limit(1)
            )
            return GameResponse.model_validate(value) if value is not None else None

    def save(self, game: GameResponse, pgn: str) -> GameResponse:
        with self.engine.begin() as connection:
            staged = connection.scalar(
                select(sources.c.payload).where(sources.c.id == game.game.id).with_for_update()
            )
            if staged is None:
                raise DiscoveryError("game_not_found", "Search for this game again.", 404)
            current_pgn = staged.get("pgn")
            if (
                not isinstance(current_pgn, str)
                or hashlib.sha256(current_pgn.encode()).hexdigest() != game.pgn_hash
            ):
                raise DiscoveryError(
                    "source_changed", "The provider game changed. Open it again.", 409
                )
            value = connection.scalar(
                select(games.c.payload)
                .where(games.c.id == game.game.id)
                .order_by(games.c.version.desc())
                .limit(1)
            )
            previous = GameResponse.model_validate(value) if value is not None else None
            if previous is not None and previous.pgn_hash == game.pgn_hash:
                return previous
            saved = game.model_copy(update={"version": previous.version + 1 if previous else 1})
            connection.execute(
                insert(games).values(
                    id=game.game.id,
                    version=saved.version,
                    pgn_hash=saved.pgn_hash,
                    payload=saved.model_dump(mode="json"),
                    pgn=pgn,
                )
            )
            return saved

    def close(self) -> None:
        self.engine.dispose()
