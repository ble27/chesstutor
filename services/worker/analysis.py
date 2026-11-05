import asyncio
from collections.abc import Mapping
from pathlib import Path
from time import monotonic
from uuid import UUID

import chess
import chess.engine

from services.adapters.analysis_records import StoredJob
from services.adapters.analysis_store import PostgresAnalyses, utc_now
from services.adapters.engine_binary import Artifact, selected_artifact, verify_binary
from services.adapters.game_store import PostgresGameStore
from services.adapters.stockfish import open_engine
from services.api.app.settings import Settings
from services.core.analysis.runner import AnalysisCancelled, analyse_game
from services.core.analysis.values import MoveEvidence
from services.core.classification.verification import verify_move


def execute(identifier: str, token: str) -> None:
    settings = Settings()
    database = PostgresGameStore(settings.database_url.get_secret_value())
    try:
        asyncio.run(
            run_job(
                PostgresAnalyses(database.engine),
                UUID(identifier),
                UUID(token),
                settings.engine_path,
                selected_artifact(settings.engine_platform),
            )
        )
    finally:
        database.close()


def compatible_engine_identity(current: Mapping[str, object], stored: Mapping[str, object]) -> bool:
    if current == stored:
        return True
    # Earlier jobs retain their cache identity and can finish with the same engine.
    normalized = dict(stored)
    if stored.get("classification_version") == "pending-v1":
        normalized["classification_version"] = current.get("classification_version")
    if stored.get("feature_version") == "none-v1" and current.get("feature_version") == "s4-v1":
        normalized["feature_version"] = "s4-v1"
    return normalized == current


async def run_job(
    store: PostgresAnalyses, identifier: UUID, token: UUID, path: Path, artifact: Artifact
) -> None:
    job = await asyncio.to_thread(store.claim, identifier, token, utc_now())
    if job is None:
        return
    try:
        identity = await asyncio.to_thread(verify_binary, path, artifact)
        if not compatible_engine_identity(identity, job.engine):
            raise ValueError("Analysis engine identity changed")
        await search_job(store, job, path)
    except AnalysisCancelled:
        await asyncio.to_thread(store.finish, identifier, token, "cancelled", None, utc_now())
    except TimeoutError:
        await asyncio.to_thread(store.finish, identifier, token, "failed", "timeout", utc_now())
    except ValueError:
        await asyncio.to_thread(
            store.finish, identifier, token, "failed", "invalid_evidence", utc_now()
        )
    except chess.engine.EngineError, OSError:
        await asyncio.to_thread(
            store.finish, identifier, token, "failed", "engine_failure", utc_now()
        )
    else:
        await asyncio.to_thread(store.finish, identifier, token, "completed", None, utc_now())


async def search_job(store: PostgresAnalyses, job: StoredJob, path: Path) -> None:
    async def checkpoint() -> None:
        await asyncio.to_thread(store.pulse, job.id, job.token, utc_now())

    if job.deadline_at is None:
        raise ValueError("Running analysis has no deadline")
    deadline = monotonic() + (job.deadline_at - utc_now()).total_seconds()
    moves = []
    for position in job.game_data.positions[1:]:
        if position.uci is None:
            raise ValueError("Missing canonical move")
        moves.append(position.uci)
    board = chess.Board(job.game_data.initial_fen)
    for uci in moves[: job.completed_plies]:
        board.push_uci(uci)
    await checkpoint()
    async with asyncio.timeout_at(deadline):
        async with open_engine(path) as engine:

            async def publish(evidence: MoveEvidence) -> None:
                if board.fen() != evidence.root_fen:
                    raise ValueError("Verification root disagrees with canonical history")

                async def reserve(cost_ms: int) -> bool:
                    return await asyncio.to_thread(
                        store.reserve_verification,
                        job.id,
                        job.token,
                        evidence.ply,
                        cost_ms,
                        evidence.best[0].time_ms + evidence.played.time_ms,
                        utc_now(),
                    )

                review = None
                if job.engine.get("feature_version") == "s4-v1":
                    review = await verify_move(
                        board.copy(),
                        evidence,
                        job.mode,
                        engine,
                        reserve,
                        checkpoint,
                        deadline=deadline,
                    )
                await asyncio.to_thread(
                    store.save_ply, job.id, job.token, evidence, utc_now(), review
                )
                board.push_uci(evidence.played_uci)

            await analyse_game(
                job.game_data.initial_fen,
                tuple(moves),
                job.mode,
                engine,
                publish,
                checkpoint,
                job.completed_plies + 1,
                deadline,
            )
