import os
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from psycopg import sql
from psycopg.conninfo import make_conninfo

from services.api.app.settings import Settings


@pytest.fixture(scope="session", autouse=True)
def isolated_integration_database():
    """Live reconciliation must never consume integration fixture jobs."""
    configured = Settings().database_url.get_secret_value()
    name = "chesstutor_tests_" + uuid4().hex
    admin_url = make_conninfo(configured, dbname="postgres")
    previous = os.environ.get("CHESS_DATABASE_URL")
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            os.environ["CHESS_DATABASE_URL"] = urlunsplit(
                urlsplit(configured)._replace(path="/" + name)
            )
            command.upgrade(Config("alembic.ini"), "head")
            yield
        finally:
            if previous is None:
                os.environ.pop("CHESS_DATABASE_URL", None)
            else:
                os.environ["CHESS_DATABASE_URL"] = previous
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))
