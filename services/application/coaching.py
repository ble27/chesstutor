"""Build lessons and coach answers from a stored analysis; no I/O happens here."""

import chess

from services.api.app.analysis_schemas import AnalysisResponse
from services.api.app.coaching_schemas import (
    AlternativeOut,
    ArrowOut,
    CoachBlockOut,
    CoachRequest,
    CoachResponse,
    LessonOut,
    LessonsResponse,
    PracticeThemeOut,
)
from services.core.analysis.values import AnalysisError, MoveEvidence
from services.core.classification.review import legal_line
from services.core.coaching.coach import coach
from services.core.coaching.detectors import detect_evidence
from services.core.coaching.lessons import (
    FLAW_KINDS,
    Arrow,
    Lesson,
    build_lessons,
    lesson_kind,
    make_arrow,
)
from services.core.coaching.templates import render_blocks, render_coaching
from services.core.coaching.values import Evidence, Level

MAX_GAME_EVIDENCE = 6


def arrow_out(arrow: Arrow) -> ArrowOut:
    return ArrowOut(
        kind=arrow.kind,
        rank=arrow.rank,
        from_square=arrow.from_square,
        to_square=arrow.to_square,
        uci=arrow.uci,
    )


def lesson_out(lesson: Lesson) -> LessonOut:
    ids = [item for block in lesson.blocks for item in block.evidence_ids]
    return LessonOut(
        ply=lesson.ply,
        kind=lesson.kind,
        text=render_blocks(lesson.blocks),
        evidence_ids=ids,
        alternatives=[
            AlternativeOut(rank=a.rank, uci=a.uci, text=a.description) for a in lesson.alternatives
        ],
        arrows=[arrow_out(arrow) for arrow in lesson.arrows],
    )


def lessons_response(analysis: AnalysisResponse, level: Level) -> LessonsResponse:
    by_ply = {item.ply: item for item in analysis.evidence}
    pairs = [
        (review, by_ply[review.ply]) for review in analysis.classifications if review.ply in by_ply
    ]
    return LessonsResponse(
        analysis_id=analysis.id,
        level=level,
        complete=analysis.state == "completed",
        lessons=[lesson_out(lesson) for lesson in build_lessons(pairs, level)],
    )


def best_first_move(move: MoveEvidence) -> tuple[str, ...]:
    """The engine's first move, only when its whole line replays legally from the root."""
    board = chess.Board(move.root_fen)
    if not move.best or not legal_line(board, move.best[0]) or move.best[0].bounded:
        return ()
    return (move.best[0].pv[0].uci,)


def position_evidence(move: MoveEvidence) -> tuple[Evidence, ...]:
    return detect_evidence(fen=move.root_fen, ply=move.ply, continuation_uci=best_first_move(move))


def game_evidence(analysis: AnalysisResponse) -> list[Evidence]:
    by_ply = {item.ply: item for item in analysis.evidence}
    found: list[Evidence] = []
    for review in analysis.classifications:
        kind = lesson_kind(review)
        if review.ply in by_ply and kind in FLAW_KINDS:
            found.extend(position_evidence(by_ply[review.ply]))
    return found[:MAX_GAME_EVIDENCE]


def context_move(analysis: AnalysisResponse, request: CoachRequest) -> MoveEvidence:
    """The analyzed move a question is about; game advice may use the latest analyzed move."""
    exact = next((item for item in analysis.evidence if item.ply == request.ply), None)
    if exact is not None:
        return exact
    if request.intent == "game_improvement" and analysis.evidence:
        return analysis.evidence[-1]
    raise AnalysisError("ply_not_analyzed", "This move has not been analyzed yet.", 409)


def coach_response(analysis: AnalysisResponse, request: CoachRequest) -> CoachResponse:
    move = context_move(analysis, request)
    items = (
        game_evidence(analysis) if request.intent == "game_improvement" else position_evidence(move)
    )
    result = coach(
        game_id=str(analysis.game_id),
        analysis_id=str(analysis.id),
        game_exists=True,
        analysis_exists=True,
        total_plies=analysis.total_plies,
        ply=move.ply,
        fen=move.root_fen,
        player_color=request.player_color,
        level=request.level,
        intent=request.intent,
        question=request.question,
        evidence=items,
        analysis_state=analysis.state,
    )
    arrows = [arrow_out(make_arrow("suggested", 1, uci)) for uci in result.continuation_uci[:1]]
    return CoachResponse(
        status=result.status,
        text=render_coaching(result),
        player_color=request.player_color,
        blocks=[
            CoachBlockOut(template_id=b.template_id, evidence_ids=list(b.evidence_ids))
            for b in result.blocks
        ],
        evidence_ids=list(result.evidence_ids),
        continuation_uci=list(result.continuation_uci),
        arrows=arrows,
        suggest_deep=result.suggest_deep,
        scope=result.scope,
        supporting_plies=list(result.supporting_plies),
        practice_themes=[
            PracticeThemeOut(theme=t.theme, supporting_plies=list(t.supporting_plies))
            for t in result.practice_themes
        ],
    )
