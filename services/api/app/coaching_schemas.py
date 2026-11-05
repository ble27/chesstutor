"""API contract for per-ply lessons and grounded coach answers."""

from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from services.api.app.game_schemas import StrictModel
from services.core.analysis.values import Color
from services.core.coaching.values import Intent, Level

LessonKind = Literal["miss", "mistake", "blunder", "great", "brilliant"]
CoachStatus = Literal["grounded", "uncertain", "refused"]


class CoachRequest(StrictModel):
    ply: int = Field(ge=1, le=300)
    player_color: Color
    level: Level
    intent: Intent | None = None
    question: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def needs_intent_or_question(self) -> CoachRequest:
        if self.intent is None and not (self.question and self.question.strip()):
            raise ValueError("Choose a supported question or enter a chess question")
        return self


class ArrowOut(StrictModel):
    kind: Literal["played", "suggested"]
    rank: int = Field(ge=0, le=2)
    from_square: str = Field(pattern=r"^[a-h][1-8]$")
    to_square: str = Field(pattern=r"^[a-h][1-8]$")
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")


class AlternativeOut(StrictModel):
    rank: int = Field(ge=1, le=2)
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    text: str = Field(max_length=300)


class LessonOut(StrictModel):
    ply: int = Field(ge=1, le=300)
    kind: LessonKind
    text: str = Field(max_length=800)
    evidence_ids: list[str] = Field(max_length=8)
    alternatives: list[AlternativeOut] = Field(max_length=2)
    arrows: list[ArrowOut] = Field(max_length=3)


class LessonsResponse(StrictModel):
    analysis_id: UUID
    level: Level
    complete: bool
    lessons: list[LessonOut]


class CoachBlockOut(StrictModel):
    template_id: str
    evidence_ids: list[str]


class PracticeThemeOut(StrictModel):
    theme: str
    supporting_plies: list[int]


class CoachResponse(StrictModel):
    status: CoachStatus
    text: str = Field(max_length=1500)
    player_color: Color
    blocks: list[CoachBlockOut]
    evidence_ids: list[str]
    continuation_uci: list[str]
    arrows: list[ArrowOut]
    suggest_deep: bool
    scope: str
    supporting_plies: list[int]
    practice_themes: list[PracticeThemeOut]
