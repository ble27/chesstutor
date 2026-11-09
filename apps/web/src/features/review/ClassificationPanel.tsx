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
      <p>Independent classifications use Chess Tutor policy v2.</p>
      <p>
        Brilliant is a heuristic; badges require checked supporting evidence.
      </p>
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
      {move?.proofs.map((proof) => (
        <div key={proof.id}>
          <p>
            {proof.badge === "brilliant"
              ? "Brilliant (heuristic)"
              : proof.badge === "great"
                ? "Great"
                : "Miss"}
          </p>
          <p>
            Checked supporting line:{" "}
            {proof.line.pv.map((step) => step.san).join(" ")}
          </p>
          <p>
            {proof.badge === "miss" ? "Missed opportunity" : "Verification"}:{" "}
            {proof.motif.replaceAll("_", " ")}
          </p>
        </div>
      ))}
    </section>
  );
}
