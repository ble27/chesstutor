from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

from sqlalchemy import delete

from services.adapters.analysis_store import PostgresAnalyses, analyses, utc_now
from services.adapters.engine_binary import selected_artifact, verify_binary
from services.adapters.game_store import PostgresGameStore, games, sources
from services.adapters.provider_data import ProviderGame
from services.api.app.game_schemas import GameResponse
from services.api.app.settings import Settings
from services.core.games.importer import parse_game
from tests.unit.discovery_fakes import provider_game


@contextmanager
def analysis_fixture(mode="quick", pgn=None, white_result="win", black_result="resigned"):
    database = PostgresGameStore(Settings().database_url.get_secret_value())
    store = PostgresAnalyses(database.engine)
    payload = provider_game(int(uuid4().hex[:12], 16), end_time=1700000000)
    if pgn is not None:
        payload["pgn"] = pgn
    payload["white"]["result"], payload["black"]["result"] = white_result, black_result
    record = ProviderGame.model_validate(payload)
    summary = record.summary()
    parsed = parse_game(record.pgn, "chess", white_result, black_result)
    game = GameResponse(
        game=summary,
        version=1,
        pgn_hash=parsed.pgn_hash,
        result=parsed.result,
        initial_fen=parsed.initial_fen,
        positions=[asdict(position) for position in parsed.positions],
    )
    database.stage([(summary.id, record.model_dump())])
    database.save(game, record.pgn)
    provenance = verify_binary(Path("bin/stockfish"), selected_artifact())
    owner, ip = uuid4().hex, uuid4().hex
    try:
        yield store, store.submit(summary.id, mode, owner, ip, provenance, utc_now(), 100, True)[0]
    finally:
        with database.engine.begin() as connection:
            connection.execute(delete(analyses).where(analyses.c.game_id == summary.id))
            connection.execute(delete(games).where(games.c.id == summary.id))
            connection.execute(delete(sources).where(sources.c.id == summary.id))
        database.close()
