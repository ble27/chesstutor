import type { Analysis } from "../../api/analysis";

type Review = NonNullable<Analysis["classifications"]>[number];

export function LabelLoss({ review }: { review: Review | undefined }) {
  if (!review) return null;
  const loss = review.classification.expected_loss;
  return (
    <p className="move-note-context">
      Base label: {review.classification.base_label} · Expected-score loss:{" "}
      {loss === null ? "unavailable" : `${(loss * 100).toFixed(1)}%`}
    </p>
  );
}
