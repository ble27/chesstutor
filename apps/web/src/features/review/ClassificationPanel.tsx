import type { Analysis } from "../../api/analysis";
import { ClassificationSummary } from "./ClassificationSummary";
import { ProofEvidence } from "./ProofEvidence";

export function SelectedMoveClassification({
  job,
  selectedPly,
}: {
  job: Analysis;
  selectedPly: number;
}) {
  const move = job.classifications?.find((item) => item.ply === selectedPly);
  if (!move) return null;
  return (
    <div className="selected-classification">
      <p>
        Independent classification: {move.classification.base_label}
        {move.provisional && " · Quick is provisional relative to Deep"}
      </p>
      <ProofEvidence move={move} themes={job.summary?.practice_themes ?? []} />
    </div>
  );
}

export function ClassificationPanel({
  job,
  selectedPly,
}: {
  job: Analysis;
  selectedPly: number;
}) {
  const move = job.classifications?.find((item) => item.ply === selectedPly);
  const coverage = job.summary?.coverage;
  return (
    <section aria-label="Move classifications">
      <p>Independent classifications use Chess Tutor policy v1.</p>
      <p>Miss, Great, and Brilliant badge verification is not available yet.</p>
      {move && (
        <p>
          Independent classification:{" "}
          {move.classification.base_label[0]?.toUpperCase()}
          {move.classification.base_label.slice(1)}
          {move.provisional && " · Quick is provisional relative to Deep"}
        </p>
      )}
      {coverage && (
        <p>
          {coverage.classified_plies} of {coverage.total_plies} moves classified
          {!job.summary?.is_final && " · analysis incomplete"}
        </p>
      )}
      {job.summary && <ClassificationSummary summary={job.summary} />}
      {move?.badges.map((badge) => (
        <p key={badge}>
          {badge === "brilliant" ? "Brilliant (heuristic)" : badge}
        </p>
      ))}
    </section>
  );
}
