from datetime import datetime
from uuid import UUID

from pydantic import Field, JsonValue

from services.api.app.analysis_schemas import AnalysisResponse
from services.api.app.game_schemas import GameResponse, StrictModel
from services.core.analysis.accuracy import accuracy_summary
from services.core.analysis.values import ACTIVE_STATES, JobState, Mode, MoveEvidence
from services.core.classification.review import ReviewedMove, classify_evidence
from services.core.classification.summary import summarize_game


class StoredJob(StrictModel):
    id: UUID
    game_id: UUID
    owner: str
    ip_digest: str
    cache_key: str
    mode: Mode
    state: JobState
    game_data: GameResponse
    engine: dict[str, JsonValue]
    token: UUID
    attempts: int = Field(ge=0, le=2)
    completed_plies: int = Field(ge=0, le=300)
    total_plies: int = Field(ge=1, le=300)
    dispatch_pending: bool
    created_at: datetime
    updated_at: datetime
    heartbeat: datetime | None
    deadline_at: datetime | None
    error_code: str | None
    verification_reserved_ms: int = Field(default=0, ge=0)
    persisted_reviews: list[ReviewedMove] | None = Field(default=None, exclude=True)

    def response(
        self, owner: str, evidence: list[MoveEvidence], cached: bool = False
    ) -> AnalysisResponse:
        compatible = self.engine.get("classification_version") == "v3"
        classified = self.persisted_reviews
        if classified is None:
            classified = (
                [classify_evidence(item, self.mode) for item in evidence] if compatible else []
            )
        summary = (
            summarize_game(state=self.state, total_plies=self.total_plies, moves=classified)
            if compatible
            else None
        )
        return AnalysisResponse(
            id=self.id,
            game_id=self.game_id,
            game_version=self.game_data.version,
            mode=self.mode,
            state=self.state,
            completed_plies=self.completed_plies,
            total_plies=self.total_plies,
            attempts=self.attempts,
            created_at=self.created_at,
            updated_at=self.updated_at,
            deadline_at=self.deadline_at,
            error_code=self.error_code,
            dispatch_pending=self.dispatch_pending,
            cached=cached,
            can_cancel=self.owner == owner and self.state in ACTIVE_STATES,
            engine=self.engine,
            evidence=evidence,
            classifications=classified,
            summary=summary,
            accuracy=accuracy_summary(
                evidence,
                self.total_plies,
                self.state,
                "white" if self.game_data.initial_fen.split()[1] == "w" else "black",
            ),
        )
