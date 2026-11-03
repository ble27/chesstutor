from datetime import datetime
from uuid import UUID

from pydantic import Field, JsonValue

from services.api.app.analysis_schemas import AnalysisResponse
from services.api.app.game_schemas import GameResponse, StrictModel
from services.core.analysis.values import ACTIVE_STATES, JobState, Mode, MoveEvidence


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

    def response(
        self, owner: str, evidence: list[MoveEvidence], cached: bool = False
    ) -> AnalysisResponse:
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
        )
