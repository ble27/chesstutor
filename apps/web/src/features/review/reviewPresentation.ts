import type { Analysis } from "../../api/analysis";
import type { Evidence } from "../../api/analysisEvidence";

type Score = Evidence["played"]["score"];
type PresentationInput = {
  gameId: string;
  selectedPly: number;
  evidence: { gameId: string; ply: number; score: Score } | null;
  state: Analysis["state"];
  completedPlies: number;
  totalPlies: number;
  mode: Analysis["mode"];
  retryAfterSeconds?: number;
};

const statuses = {
  queued: "Queued",
  running: "Running",
  cancel_requested: "Cancellation requested",
  cancelled: "Cancelled",
  completed: "Completed",
  failed: "Failed",
};

export function formatWhiteEvaluation(score: Score, digits = 1): string {
  const direction = score.pov === "white" ? 1 : -1;
  if (score.kind === "mate") {
    const moves = direction * score.moves;
    return `${moves < 0 ? "-" : ""}M${Math.abs(moves)}`;
  }
  const pawns = (direction * score.centipawns) / 100;
  const rounded = Number(pawns.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${(rounded === 0 ? 0 : pawns).toFixed(digits)}`;
}

export function whiteAdvantage(score: Score, result: string | null): number {
  const direction = score.pov === "white" ? 1 : -1;
  if (score.kind === "cp")
    return Math.tanh((0.00368208 * score.centipawns * direction) / 2);
  if (score.moves !== 0) return Math.sign(score.moves) * direction;
  return result === "1-0" ? 1 : result === "0-1" ? -1 : 0;
}

export function reviewPresentation(input: PresentationInput) {
  const evidence =
    input.evidence?.gameId === input.gameId &&
    input.evidence.ply === input.selectedPly
      ? input.evidence
      : null;
  const isFinal =
    input.state === "completed" && input.completedPlies === input.totalPlies;
  return {
    evaluation: evidence ? formatWhiteEvaluation(evidence.score) : null,
    evidenceStatus: evidence ? ("available" as const) : ("pending" as const),
    coverageText: `${input.completedPlies}/${input.totalPlies} plies`,
    isFinal,
    canRetry: input.state === "failed" || input.state === "cancelled",
    statusText:
      input.state === "completed" && !isFinal
        ? "Incomplete"
        : statuses[input.state],
    provisional: input.mode === "quick",
    retryAfterSeconds: input.retryAfterSeconds ?? null,
  };
}
