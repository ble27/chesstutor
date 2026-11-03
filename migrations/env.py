from alembic import context
from sqlalchemy import create_engine

from services.adapters.game_store import metadata
from services.api.app.settings import Settings


def migrate() -> None:
    url = (
        Settings()
        .database_url.get_secret_value()
        .replace("postgresql://", "postgresql+psycopg://", 1)
    )
    url = url.replace("postgres://", "postgresql+psycopg://", 1)
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


migrate()
