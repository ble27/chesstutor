import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";
import { positionAnalysis } from "./positionAnalysis";
import { formatScore } from "./EngineEvidence";
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
    const direction = score.pov === "white" ? 1 : -1;
    const advantage =
      score.kind === "cp"
        ? Math.tanh((0.00368208 * score.centipawns * direction) / 2)
        : score.moves === 0
          ? view.result === "1-0"
            ? 1
            : view.result === "0-1"
              ? -1
              : 0
          : Math.sign(score.moves) * direction;
    return { ply, label: formatScore(score, 2), advantage };
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
