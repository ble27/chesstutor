import type { LessonArrow } from "../../api/coaching";
import type { Evidence } from "../../api/analysisEvidence";
import { formatScore } from "../review/EngineEvidence";

export type BoardArrow = {
  startSquare: string;
  endSquare: string;
  color: string;
  rootFen: string;
  ply: number;
};

// Colour is never the only cue: the panel lists every arrow in words as well.
const PLAYED = "#49160e";
const SUGGESTED = "#ACC65B";

export function toBoardArrows(
  arrows: readonly LessonArrow[],
  evidence: Evidence,
): BoardArrow[] {
  return arrows.map((arrow) => ({
    startSquare: arrow.from_square,
    endSquare: arrow.to_square,
    color: arrow.kind === "played" ? PLAYED : SUGGESTED,
    rootFen: evidence.root_fen,
    ply: evidence.ply,
  }));
}

export function arrowDescription(
  arrow: LessonArrow,
  evidence?: Evidence,
): string {
  const label =
    arrow.kind === "played" ? "Your move" : `Suggestion ${arrow.rank}`;
  const description = `${label}: ${arrow.from_square} to ${arrow.to_square}`;
  if (arrow.kind === "played") return description;
  const line = evidence?.best.find(
    (item) => !item.bounded && item.pv[0]?.uci === arrow.uci,
  );
  if (!line) return `${description} · Evaluation unavailable`;
  const pov = line.score.pov === "white" ? "White" : "Black";
  return `${description} · ${pov} evaluation: ${formatScore(line.score)}`;
}
