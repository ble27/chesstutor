import type { components } from "../../api/generated";

type Review = components["schemas"]["ReviewedMove"];
type Player = components["schemas"]["PlayerSummary"];
type SummaryColumn = {
  counts: Record<string, number>;
  total: number;
  scored: number;
  average: string;
  accuracy: string;
};

export const CLASSIFICATION_LABELS = [
  ["brilliant", "Brilliant"],
  ["great", "Great move"],
  ["best", "Best move"],
  ["good", "Good"],
  ["forced", "Forced"],
  ["inaccuracy", "Inaccuracy"],
  ["mistake", "Mistake"],
  ["blunder", "Blunder"],
  ["miss", "Miss"],
  ["unclassified", "Unclassified"],
] as const;

export function primaryLabel(move: Review): string {
  for (const badge of ["brilliant", "great", "miss"] as const)
    if (move.badges.includes(badge)) return badge;
  return move.classification.base_label;
}

export function summaryColumn(
  player: Player | undefined,
  reviews?: readonly Review[],
): SummaryColumn {
  const counts: Record<string, number> =
    reviews === undefined ? { ...player?.counts } : {};
  for (const move of reviews ?? []) {
    const label = primaryLabel(move);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const scored = total - (counts.unclassified ?? 0);
  const average = player?.average_expected_loss ?? null;
  return {
    counts,
    total,
    scored,
    average:
      average === null ? "Unavailable" : `${(average * 100).toFixed(1)}%`,
    accuracy:
      average === null ? "Unavailable" : `${(100 * (1 - average)).toFixed(1)}%`,
  };
}
