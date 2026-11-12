import type { components } from "./generated";
import { request } from "./client";
import {
  array,
  color,
  flag,
  identifier,
  integer,
  object,
  text,
} from "./analysisFields";

export type Lessons = components["schemas"]["LessonsResponse"];
export type Lesson = Lessons["lessons"][number];
export type LessonArrow = Lesson["arrows"][number];
export type CoachRequest = components["schemas"]["CoachRequest"];
export type CoachAnswer = components["schemas"]["CoachResponse"];
export type Level = Lessons["level"];
export type Intent = NonNullable<CoachRequest["intent"]>;

const SQUARE = /^[a-h][1-8]$/;
const MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

function square(value: unknown): string {
  const name = text(value, 2);
  if (!SQUARE.test(name)) throw new Error("Invalid square");
  return name;
}
function move(value: unknown): string {
  const uci = text(value, 5);
  if (!MOVE.test(uci)) throw new Error("Invalid move");
  return uci;
}
function level(value: unknown): Level {
  if (value !== "beginner" && value !== "intermediate")
    throw new Error("Invalid level");
  return value;
}
function arrow(input: unknown): LessonArrow {
  const value = object(input);
  if (value.kind !== "played" && value.kind !== "suggested")
    throw new Error("Invalid arrow");
  return {
    kind: value.kind,
    rank: integer(value.rank, 0, 2),
    from_square: square(value.from_square),
    to_square: square(value.to_square),
    uci: move(value.uci),
  };
}
function alternative(input: unknown): Lesson["alternatives"][number] {
  const value = object(input);
  return {
    rank: integer(value.rank, 1, 2),
    uci: move(value.uci),
    text: text(value.text, 300),
  };
}
function kind(value: unknown): Lesson["kind"] {
  switch (value) {
    case "miss":
    case "mistake":
    case "blunder":
    case "great":
    case "brilliant":
    case "good":
    case "best":
    case "inaccuracy":
    case "forced":
    case "unclassified":
      return value;
    default:
      throw new Error("Invalid lesson kind");
  }
}
function lesson(input: unknown): Lesson {
  const value = object(input);
  return {
    ply: integer(value.ply, 1, 300),
    kind: kind(value.kind),
    text: text(value.text, 800),
    evidence_ids: array(value.evidence_ids, 8).map((id) => text(id, 120)),
    alternatives: array(value.alternatives, 2).map(alternative),
    arrows: array(value.arrows, 3).map(arrow),
  };
}
export function parseLessons(input: unknown): Lessons {
  const value = object(input);
  return {
    analysis_id: identifier(value.analysis_id),
    level: level(value.level),
    complete: flag(value.complete),
    lessons: array(value.lessons, 300).map(lesson),
  };
}
function status(value: unknown): CoachAnswer["status"] {
  if (value !== "grounded" && value !== "uncertain" && value !== "refused")
    throw new Error("Invalid coach status");
  return value;
}
export function parseCoach(input: unknown): CoachAnswer {
  const value = object(input);
  return {
    status: status(value.status),
    text: text(value.text, 1500),
    player_color: color(value.player_color),
    blocks: array(value.blocks, 12).map((item) => {
      const block = object(item);
      return {
        template_id: text(block.template_id, 80),
        evidence_ids: array(block.evidence_ids, 12).map((id) => text(id, 120)),
      };
    }),
    evidence_ids: array(value.evidence_ids, 12).map((id) => text(id, 120)),
    continuation_uci: array(value.continuation_uci, 8).map(move),
    arrows: array(value.arrows, 3).map(arrow),
    suggest_deep: flag(value.suggest_deep),
    scope: text(value.scope, 40),
    supporting_plies: array(value.supporting_plies, 300).map((ply) =>
      integer(ply, 0, 300),
    ),
    practice_themes: array(value.practice_themes, 8).map((item) => {
      const theme = object(item);
      return {
        theme: text(theme.theme, 40),
        supporting_plies: array(theme.supporting_plies, 300).map((ply) =>
          integer(ply, 0, 300),
        ),
      };
    }),
  };
}
export const readLessons = (id: string, selected: Level, signal: AbortSignal) =>
  request(
    `/api/v1/analyses/${encodeURIComponent(id)}/lessons?level=${selected}`,
    parseLessons,
    { signal, timeoutMs: 10000 },
  );
export const askCoach = (id: string, body: CoachRequest, signal: AbortSignal) =>
  request(`/api/v1/analyses/${encodeURIComponent(id)}/coach`, parseCoach, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
    timeoutMs: 10000,
  });
