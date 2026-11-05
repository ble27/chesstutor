import asyncio
from pathlib import Path

import pytest

from services.adapters.engine_binary import selected_artifact, verify_binary
from services.adapters.stockfish import open_engine

ENGINE = Path("bin/stockfish")


@pytest.mark.integration
def test_installed_binary_matches_the_pinned_artifact_and_job_identity():
    identity = verify_binary(ENGINE, selected_artifact())
    assert identity["version"] == "19"
    assert identity["options"] == {"Threads": 1, "Hash": 128, "UCI_ShowWDL": True}


@pytest.mark.integration
def test_running_engine_announces_stockfish_19_and_supports_wdl():
    async def announce() -> tuple[str, bool]:
        async with open_engine(ENGINE) as engine:
            options = engine.protocol.options
            return str(engine.protocol.id["name"]), "UCI_ShowWDL" in options

    name, wdl_supported = asyncio.run(announce())
    assert name == "Stockfish 19"
    assert wdl_supported
