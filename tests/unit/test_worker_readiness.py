import asyncio
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest

from services.api.app.settings import Settings
from services.worker import main as worker


def test_readiness_probes_real_search_not_only_option_configuration(monkeypatch):
    engine = AsyncMock()
    engine.search.side_effect = OSError("hash allocation failed")

    @asynccontextmanager
    async def open_engine(_path):
        yield engine

    monkeypatch.setattr(worker, "open_engine", open_engine)
    with pytest.raises(OSError, match="hash allocation failed"):
        asyncio.run(worker.engine_probe(Settings(_env_file=None)))
