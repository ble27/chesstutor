import type { LessonArrow } from "../../api/coaching";

export type BoardArrow = {
  startSquare: string;
  endSquare: string;
  color: string;
};

// Colour is never the only cue: the panel lists every arrow in words as well.
const PLAYED = "#b5483a";
const SUGGESTED = "#3f7f5f";

export function toBoardArrows(arrows: readonly LessonArrow[]): BoardArrow[] {
  return arrows.map((arrow) => ({
    startSquare: arrow.from_square,
    endSquare: arrow.to_square,
    color: arrow.kind === "played" ? PLAYED : SUGGESTED,
  }));
}

export function arrowDescription(arrow: LessonArrow): string {
  const label =
    arrow.kind === "played" ? "Your move" : `Suggestion ${arrow.rank}`;
  return `${label}: ${arrow.from_square} to ${arrow.to_square}`;
}
