import type { CSSProperties } from "react";
import type { Evidence } from "../../api/analysisEvidence";
import { formatWhiteEvaluation, whiteAdvantage } from "./reviewPresentation";

type Score = Evidence["played"]["score"];

export function EvaluationRail({
  score,
  orientation,
  result,
}: {
  score: Score | null;
  result: string | null;
  orientation: "white" | "black";
}) {
  const whiteShare = 50 + 47 * (score ? whiteAdvantage(score, result) : 0);
  const label = score ? formatWhiteEvaluation(score, 2) : "—";
  return (
    <div
      className={`evaluation-rail ${orientation}`}
      role="img"
      aria-label={
        score
          ? `Evaluation ${label}, White perspective`
          : "Evaluation unavailable"
      }
      style={{ "--white-share": `${whiteShare}%` } as CSSProperties}
    >
      <span className="evaluation-fill" />
      <strong>{label}</strong>
    </div>
  );
}
