import hashlib
import json
import math
from collections.abc import Sequence
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID, uuid4

import chess
from pydantic import JsonValue, TypeAdapter
from sqlalchemy import case, func, insert, or_, select, text, update
from sqlalchemy.engine import Connection, Engine

from services.adapters.analysis_records import StoredJob
from services.adapters.analysis_tables import analyses, reviews
from services.adapters.game_store import games
from services.api.app.game_schemas import GameResponse
from services.core.analysis.runner import AnalysisCancelled
from services.core.analysis.values import ACTIVE_STATES, PRESETS, AnalysisError, Mode, MoveEvidence
from services.core.classification.review import ReviewedMove, classify_evidence
from services.core.classification.verification import validate_verified_review

GATE_LOCK = 724193301
evidence_adapter = TypeAdapter(MoveEvidence)
review_adapter = TypeAdapter(ReviewedMove)


def utc_now() -> datetime:
    return datetime.now(UTC)


def serial_gate(connection: Connection) -> None:
    connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": GATE_LOCK})


def cache_key(game: GameResponse, mode: Mode, engine: dict[str, JsonValue]) -> str:
    payload = [str(game.game.id), game.version, game.pgn_hash, mode, engine]
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


class PostgresAnalyses:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def get(self, identifier: UUID) -> StoredJob:
        with self.engine.connect() as connection:
            row = (
                connection.execute(select(analyses).where(analyses.c.id == identifier))
                .mappings()
                .first()
            )
            if row is None:
                raise AnalysisError("analysis_not_found", "Analysis not found.", 404)
            return StoredJob.model_validate(dict(row))

    def evidence(self, identifier: UUID) -> list[MoveEvidence]:
        with self.engine.connect() as connection:
            values: Sequence[object] = connection.scalars(
                select(reviews.c.payload)
                .where(reviews.c.analysis_id == identifier)
                .order_by(reviews.c.ply)
            ).all()
            return [evidence_adapter.validate_python(value) for value in values]

    def snapshot(self, identifier: UUID) -> tuple[StoredJob, list[MoveEvidence]]:
        # A worker commits each ply independently; response counters and rows must
        # come from one snapshot rather than two racing READ COMMITTED queries.
        with (
            self.engine.connect().execution_options(
                isolation_level="REPEATABLE READ"
            ) as connection,
            connection.begin(),
        ):
            row = (
                connection.execute(select(analyses).where(analyses.c.id == identifier))
                .mappings()
                .first()
            )
            if row is None:
                raise AnalysisError("analysis_not_found", "Analysis not found.", 404)
            evidence_rows = (
                connection.execute(
                    select(reviews.c.payload, reviews.c.move_review)
                    .where(reviews.c.analysis_id == identifier)
                    .order_by(reviews.c.ply)
                )
                .mappings()
                .all()
            )
            job = StoredJob.model_validate(dict(row))
            evidence = [evidence_adapter.validate_python(item["payload"]) for item in evidence_rows]
            if all(item["move_review"] is not None for item in evidence_rows):
                persisted = [
                    review_adapter.validate_python(item["move_review"]) for item in evidence_rows
                ]
                job = job.model_copy(update={"persisted_reviews": persisted})
            if job.engine.get("feature_version") == "s4-v1" and any(
                item["move_review"] is None for item in evidence_rows
            ):
                raise ValueError("Missing persisted classification")
            return job, evidence

    def submit(
        self,
        game_id: UUID,
        mode: Mode,
        owner: str,
        ip: str,
        engine: dict[str, JsonValue],
        now: datetime,
        ip_limit: int,
        ready: bool,
    ) -> tuple[StoredJob, bool]:
        with self.engine.begin() as connection:
            serial_gate(connection)
            raw = connection.scalar(
                select(games.c.payload)
                .where(games.c.id == game_id)
                .order_by(games.c.version.desc())
                .limit(1)
            )
            if raw is None:
                raise AnalysisError("game_not_found", "Import this game before analysing it.", 404)
            game = GameResponse.model_validate(raw)
            key = cache_key(game, mode, engine)
            keys = (key, cache_key(game, "deep", engine)) if mode == "quick" else (key,)
            cached = reusable_job(connection, keys, now)
            if cached is not None:
                return cached, True
            active = (
                connection.execute(
                    select(analyses)
                    .where(
                        analyses.c.owner == owner,
                        analyses.c.state.in_(ACTIVE_STATES),
                    )
                    .limit(1)
                )
                .mappings()
                .first()
            )
            if active is not None:
                if active["cache_key"] == key:
                    return StoredJob.model_validate(dict(active)), False
                raise AnalysisError(
                    "session_busy", "One active analysis is allowed per session.", 429, 5
                )
            check_submission_limits(connection, owner, ip, mode, now, ip_limit)
            if not ready:
                raise AnalysisError("engine_unavailable", "Analysis workers are not ready.", 503, 5)
            job = StoredJob(
                id=uuid4(),
                game_id=game_id,
                owner=owner,
                ip_digest=ip,
                cache_key=key,
                mode=mode,
                state="queued",
                game_data=game,
                engine=engine,
                token=uuid4(),
                attempts=0,
                completed_plies=0,
                total_plies=len(game.positions) - 1,
                dispatch_pending=True,
                created_at=now,
                updated_at=now,
                heartbeat=None,
                deadline_at=None,
                error_code=None,
            )
            values = job.model_dump(mode="json")
            for field in ("id", "game_id", "token", "created_at", "updated_at"):
                values[field] = getattr(job, field)
            connection.execute(insert(analyses).values(**values))
            return job, False

    def dispatched(self, identifier: UUID, token: UUID) -> None:
        with self.engine.begin() as connection:
            connection.execute(
                update(analyses)
                .where(
                    analyses.c.id == identifier,
                    analyses.c.token == token,
                    analyses.c.state == "queued",
                )
                .values(dispatch_pending=False)
            )

    def cancel(self, identifier: UUID, owner: str, now: datetime) -> StoredJob:
        with self.engine.begin() as connection:
            row = (
                connection.execute(
                    select(analyses).where(analyses.c.id == identifier).with_for_update()
                )
                .mappings()
                .first()
            )
            if row is None:
                raise AnalysisError("analysis_not_found", "Analysis not found.", 404)
            job = StoredJob.model_validate(dict(row))
            if job.owner != owner:
                raise AnalysisError(
                    "not_owner", "Only the initiating session can cancel this analysis.", 403
                )
            if job.state in ("queued", "running"):
                state = "cancelled" if job.state == "queued" else "cancel_requested"
                connection.execute(
                    update(analyses)
                    .where(analyses.c.id == identifier)
                    .values(
                        state=state,
                        dispatch_pending=False,
                        updated_at=now,
                    )
                )
        return self.get(identifier)

    def pending(self) -> list[StoredJob]:
        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    select(analyses)
                    .where(analyses.c.state == "queued")
                    .order_by(analyses.c.created_at)
                    .limit(50)
                )
                .mappings()
                .all()
            )
            return [StoredJob.model_validate(dict(row)) for row in rows]

    def claim(self, identifier: UUID, token: UUID, now: datetime) -> StoredJob | None:
        with self.engine.begin() as connection:
            serial_gate(connection)
            job = locked_job(connection, identifier, token, ("queued",))
            if job is None:
                return None
            active = (
                connection.scalar(
                    select(func.count())
                    .select_from(analyses)
                    .where(analyses.c.state.in_(("running", "cancel_requested")))
                )
                or 0
            )
            if active >= 2:
                connection.execute(
                    update(analyses)
                    .where(analyses.c.id == identifier)
                    .values(token=uuid4(), dispatch_pending=True, updated_at=now)
                )
                return None
            if job.attempts >= 2:
                raise ValueError("Recovery attempt budget exceeded")
            deadline = job.deadline_at or now + timedelta(
                seconds=PRESETS[job.mode].deadline_seconds
            )
            connection.execute(
                update(analyses)
                .where(analyses.c.id == identifier)
                .values(
                    state="running",
                    attempts=job.attempts + 1,
                    heartbeat=now,
                    updated_at=now,
                    deadline_at=deadline,
                    dispatch_pending=False,
                )
            )
        return self.get(identifier)

    def pulse(self, identifier: UUID, token: UUID, now: datetime) -> None:
        with self.engine.begin() as connection:
            job = locked_job(connection, identifier, token, ("running", "cancel_requested"))
            if job is None or job.state == "cancel_requested":
                raise AnalysisCancelled("Attempt cancelled or superseded")
            if job.deadline_at is None or now >= job.deadline_at:
                raise TimeoutError("Job deadline exceeded")
            connection.execute(
                update(analyses)
                .where(analyses.c.id == identifier)
                .values(heartbeat=now, updated_at=now)
            )

    def save_ply(
        self,
        identifier: UUID,
        token: UUID,
        evidence: MoveEvidence,
        now: datetime,
        review: ReviewedMove | None = None,
    ) -> None:
        with self.engine.begin() as connection:
            job = locked_job(connection, identifier, token, ("running",))
            if job is None:
                raise AnalysisCancelled("Attempt cancelled or superseded")
            if job.deadline_at is None or now >= job.deadline_at:
                raise TimeoutError("Job deadline exceeded")
            if review is not None:
                board = chess.Board(job.game_data.initial_fen)
                for position in job.game_data.positions[1 : evidence.ply]:
                    if position.uci is None:
                        raise ValueError("Missing canonical history")
                    board.push_uci(position.uci)
                validate_verified_review(board, evidence, job.mode, review)
                if sum(proof.reserved_ms for proof in review.proofs) > job.verification_reserved_ms:
                    raise ValueError("Unreserved badge search")
            payload = asdict(evidence)
            if evidence.ply <= job.completed_plies:
                previous = (
                    connection.execute(
                        select(reviews.c.payload, reviews.c.move_review).where(
                            reviews.c.analysis_id == identifier, reviews.c.ply == evidence.ply
                        )
                    )
                    .mappings()
                    .one()
                )
                if evidence_adapter.validate_python(previous["payload"]) != evidence:
                    raise ValueError("Conflicting retry of an evidence write")
                if (
                    review is not None
                    and review_adapter.validate_python(previous["move_review"]) != review
                ):
                    raise ValueError("Conflicting retry of a review write")
                return
            if evidence.ply != job.completed_plies + 1 or evidence.ply > job.total_plies:
                raise ValueError("Evidence must be written in game order")
            before, after = job.game_data.positions[evidence.ply - 1 : evidence.ply + 1]
            if evidence.root_fen != before.fen or evidence.played_uci != after.uci:
                raise ValueError("Evidence belongs to another position")
            connection.execute(
                insert(reviews).values(
                    analysis_id=identifier,
                    ply=evidence.ply,
                    payload=payload,
                    move_review=asdict(review or classify_evidence(evidence, job.mode))
                    if job.engine.get("classification_version") == "v3"
                    else None,
                )
            )
            connection.execute(
                update(analyses)
                .where(analyses.c.id == identifier)
                .values(completed_plies=evidence.ply, heartbeat=now, updated_at=now)
            )

    def reserve_verification(
        self,
        identifier: UUID,
        token: UUID,
        ply: int,
        cost_ms: int,
        current_base_ms: int,
        now: datetime,
    ) -> bool:
        if cost_ms <= 0 or current_base_ms < 0:
            raise ValueError("Invalid verification budget")
        with self.engine.begin() as connection:
            job = locked_job(connection, identifier, token, ("running",))
            if job is None:
                raise AnalysisCancelled("Attempt cancelled or superseded")
            if job.deadline_at is None or now >= job.deadline_at:
                raise TimeoutError("Job deadline exceeded")
            if ply != job.completed_plies + 1:
                raise ValueError("Verification must belong to the next unpublished ply")
            values: Sequence[object] = connection.scalars(
                select(reviews.c.payload).where(reviews.c.analysis_id == identifier)
            ).all()
            base_ms = min(current_base_ms, int(2 * PRESETS[job.mode].search_seconds * 1000))
            for value in values:
                evidence = evidence_adapter.validate_python(value)
                base_ms += evidence.best[0].time_ms + evidence.played.time_ms
            if (job.verification_reserved_ms + cost_ms) * 100 > base_ms * 15:
                return False
            connection.execute(
                update(analyses)
                .where(analyses.c.id == identifier)
                .values(
                    verification_reserved_ms=job.verification_reserved_ms + cost_ms,
                    heartbeat=now,
                    updated_at=now,
                )
            )
            return True

    def finish(
        self,
        identifier: UUID,
        token: UUID,
        state: Literal["completed", "failed", "cancelled"],
        error: str | None,
        now: datetime,
    ) -> None:
        with self.engine.begin() as connection:
            job = locked_job(connection, identifier, token, ("running", "cancel_requested"))
            if job is None:
                return
            if job.state == "cancel_requested":
                state, error = "cancelled", None
            elif state == "completed" and job.completed_plies != job.total_plies:
                state, error = "failed", "incomplete_evidence"
            connection.execute(
                update(analyses)
                .where(analyses.c.id == identifier)
                .values(state=state, error_code=error, updated_at=now)
            )

    def recover(self, now: datetime) -> None:
        with self.engine.begin() as connection:
            rows = (
                connection.execute(
                    select(analyses)
                    .where(
                        analyses.c.state.in_(("running", "cancel_requested")),
                        or_(
                            analyses.c.deadline_at <= now,
                            analyses.c.heartbeat < now - timedelta(seconds=30),
                        ),
                    )
                    .with_for_update(skip_locked=True)
                )
                .mappings()
                .all()
            )
            for row in rows:
                recover_job(connection, StoredJob.model_validate(dict(row)), now)


def locked_job(
    connection: Connection, identifier: UUID, token: UUID, states: tuple[str, ...]
) -> StoredJob | None:
    row = (
        connection.execute(
            select(analyses)
            .where(
                analyses.c.id == identifier,
                analyses.c.token == token,
                analyses.c.state.in_(states),
            )
            .with_for_update()
        )
        .mappings()
        .first()
    )
    return StoredJob.model_validate(dict(row)) if row is not None else None


def recover_job(connection: Connection, job: StoredJob, now: datetime) -> None:
    if job.state == "cancel_requested":
        values: dict[str, object] = {"state": "cancelled", "error_code": None}
    elif job.deadline_at is not None and now >= job.deadline_at:
        values = {"state": "failed", "error_code": "timeout"}
    elif job.attempts >= 2:
        values = {"state": "failed", "error_code": "worker_crashed"}
    else:
        values = {"state": "queued", "token": uuid4(), "dispatch_pending": True}
    connection.execute(
        update(analyses).where(analyses.c.id == job.id).values(**values, updated_at=now)
    )


def check_submission_limits(
    connection: Connection,
    owner: str,
    ip: str,
    mode: Mode,
    now: datetime,
    ip_limit: int,
) -> None:
    window = now - timedelta(hours=1)
    for condition, limit, code, message in (
        (
            analyses.c.owner == owner,
            5 if mode == "quick" else 2,
            "session_quota",
            "Hourly analysis quota reached for this preset.",
        ),
        (
            analyses.c.ip_digest == ip,
            ip_limit,
            "ip_quota",
            "Shared-network analysis quota reached.",
        ),
    ):
        query = select(analyses.c.created_at).where(condition, analyses.c.created_at > window)
        if code == "session_quota":
            query = query.where(analyses.c.mode == mode)
        dates: Sequence[datetime] = connection.scalars(query.order_by(analyses.c.created_at)).all()
        if len(dates) >= limit:
            retry = max(1, math.ceil((dates[0] + timedelta(hours=1) - now).total_seconds()))
            raise AnalysisError(code, message, 429, retry)
    queued = (
        connection.scalar(
            select(func.count()).select_from(analyses).where(analyses.c.state == "queued")
        )
        or 0
    )
    if queued >= 50:
        raise AnalysisError("queue_full", "The analysis queue is full. Try again shortly.", 429, 5)


def reusable_job(connection: Connection, keys: tuple[str, ...], now: datetime) -> StoredJob | None:
    row = (
        connection.execute(
            select(analyses)
            .where(
                analyses.c.cache_key.in_(keys),
                analyses.c.state == "completed",
                analyses.c.updated_at > now - timedelta(days=30),
            )
            .order_by(
                case((analyses.c.cache_key == keys[0], 0), else_=1), analyses.c.updated_at.desc()
            )
            .limit(1)
        )
        .mappings()
        .first()
    )
    return StoredJob.model_validate(dict(row)) if row is not None else None
