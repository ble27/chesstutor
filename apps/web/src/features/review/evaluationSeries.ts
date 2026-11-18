import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";
import { positionAnalysis } from "./positionAnalysis";
import { formatWhiteEvaluation, whiteAdvantage } from "./reviewPresentation";
export type EvaluationPoint = { ply: number; label: string; advantage: number };
export function evaluationSeries(
  game: Game,
  evidence: readonly Evidence[],
): (EvaluationPoint | null)[] {
  return game.positions.map((_, ply) => {
    const view = positionAnalysis(game, ply, evidence);
    if (!view || view.status !== "usable") return null;
    const score = view.score;
    if (score.kind === "mate" && score.moves === 0 && !view.result) return null;
    return {
      ply,
      label: formatWhiteEvaluation(score, 2),
      advantage: whiteAdvantage(score, view.result),
    };
  });
}
export function graphSegments(
  series: readonly (EvaluationPoint | null)[],
): EvaluationPoint[][] {
  const segments: EvaluationPoint[][] = [];
  let current: EvaluationPoint[] = [];
  for (const point of series) {
    if (point) current.push(point);
    else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}
export function smoothPath(
  points: readonly EvaluationPoint[],
  lastPly: number,
): string {
  const x = (ply: number) => (ply / Math.max(1, lastPly)) * 1000;
  const y = (advantage: number) => 50 - advantage * 45;
  let path = "";
  let previous: EvaluationPoint | null = null;
  for (const point of points) {
    if (!previous) path = `M${x(point.ply)},${y(point.advantage)}`;
    else {
      const middle = (x(previous.ply) + x(point.ply)) / 2;
      path += ` C${middle},${y(previous.advantage)} ${middle},${y(point.advantage)} ${x(point.ply)},${y(point.advantage)}`;
    }
    previous = point;
  }
  return path;
}
