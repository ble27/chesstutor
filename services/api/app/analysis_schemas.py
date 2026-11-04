from datetime import datetime
from uuid import UUID

from pydantic import Field, JsonValue, model_validator

from services.api.app.game_schemas import StrictModel
from services.core.analysis.values import JobState, Mode, MoveEvidence
from services.core.classification.review import ReviewedMove
from services.core.classification.summary import ClassificationSummary


class AnalysisRequest(StrictModel):
    game_id: UUID
    mode: Mode


class AnalysisResponse(StrictModel):
    id: UUID
    game_id: UUID
    game_version: int
    mode: Mode
    state: JobState
    completed_plies: int = Field(ge=0, le=300)
    total_plies: int = Field(ge=1, le=300)
    attempts: int = Field(ge=0, le=2)
    created_at: datetime
    updated_at: datetime
    deadline_at: datetime | None
    error_code: str | None
    dispatch_pending: bool
    cached: bool
    can_cancel: bool
    engine: dict[str, JsonValue]
    evidence: list[MoveEvidence]
    classifications: list[ReviewedMove] = Field(default_factory=list)
    summary: ClassificationSummary | None = None

    @model_validator(mode="after")
    def validate_coverage(self) -> AnalysisResponse:
        if self.completed_plies > self.total_plies:
            raise ValueError("Invalid analysis coverage")
        if self.state == "completed" and self.completed_plies != self.total_plies:
            raise ValueError("Incomplete job cannot be completed")
        return self
