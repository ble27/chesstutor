import type { components } from "./generated";
import { badgeProof, proofTheme, validateProofs } from "./badgeProof";
import { array, color, flag, integer, object, text } from "./analysisFields";

type Review = components["schemas"]["ReviewedMove"];
type Summary = components["schemas"]["ClassificationSummary"];

function label(value: unknown): Review["classification"]["base_label"] {
  switch (value) {
    case "forced":
    case "best":
    case "good":
    case "inaccuracy":
    case "mistake":
    case "blunder":
    case "unclassified":
      return value;
    default:
      throw new Error("Invalid classification");
  }
}
function loss(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  )
    throw new Error("Invalid expected loss");
  return value;
}
export function review(input: unknown): Review {
  const value = object(input),
    classification = object(value.classification);
  const badges = array(value.badges, 2).map((item) => {
    if (item !== "miss" && item !== "great" && item !== "brilliant")
      throw new Error("Invalid badge");
    return item;
  });
  const base_label = label(classification.base_label);
  const expected_loss = loss(classification.expected_loss);
  if ((base_label === "unclassified") !== (expected_loss === null))
    throw new Error("Inconsistent classification");
  return {
    ply: integer(value.ply, 1, 300),
    mover: color(value.mover),
    badges,
    proofs:
      value.proofs === undefined ? [] : array(value.proofs, 1).map(badgeProof),
    provisional: flag(value.provisional),
    classification: {
      base_label,
      expected_loss,
      policy_version: text(classification.policy_version, 40),
    },
  };
}
function player(input: unknown): Summary["players"][string] {
  const value = object(input),
    raw = object(value.counts);
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(raw))
    counts[label(key)] = integer(count, 0, 300);
  return { counts, average_expected_loss: loss(value.average_expected_loss) };
}
export function summary(input: unknown): Summary {
  const value = object(input),
    coverage = object(value.coverage),
    players = object(value.players);
  const total = integer(coverage.total_plies, 1, 300);
  const analyzed = integer(coverage.analyzed_plies, 0, total);
  return {
    players: { white: player(players.white), black: player(players.black) },
    coverage: {
      total_plies: total,
      analyzed_plies: analyzed,
      classified_plies: integer(coverage.classified_plies, 0, analyzed),
    },
    is_final: flag(value.is_final),
    game_conclusions: array(value.game_conclusions, 3).map((item) =>
      text(item),
    ),
    critical_moments: array(value.critical_moments, 3).map((item) => {
      const moment = object(item),
        expected_loss = loss(moment.expected_loss);
      if (expected_loss === null) throw new Error("Missing critical loss");
      return {
        ply: integer(moment.ply, 1, total),
        mover: color(moment.mover),
        label: label(moment.label),
        expected_loss,
      };
    }),
    practice_themes: array(value.practice_themes, 3).map((item) => {
      const theme = object(item);
      return {
        name: text(theme.name, 100),
        supporting_plies: array(theme.supporting_plies, 300).map((ply) =>
          integer(ply, 1, total),
        ),
      };
    }),
  };
}

function validateSummary(result: Summary, reviews: Review[]): void {
  for (const side of ["white", "black"] as const) {
    const selected = reviews.filter((item) => item.mover === side);
    const player = result.players[side];
    if (!player) throw new Error("Missing player summary");
    const counts: Record<string, number> = {};
    for (const item of selected) {
      const key = item.classification.base_label;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (
      Object.keys(counts).length !== Object.keys(player.counts).length ||
      Object.entries(counts).some(
        ([key, count]) => player.counts[key] !== count,
      )
    )
      throw new Error("Inconsistent player counts");
    const losses = selected.flatMap((item) =>
      item.classification.expected_loss === null
        ? []
        : [item.classification.expected_loss],
    );
    const expected = losses.length
      ? losses.reduce((a, b) => a + b, 0) / losses.length
      : null;
    if (
      (expected === null) !== (player.average_expected_loss === null) ||
      (expected !== null &&
        player.average_expected_loss !== null &&
        Math.abs(expected - player.average_expected_loss) > 1e-9)
    )
      throw new Error("Inconsistent player average");
  }
  if (result.game_conclusions.length)
    throw new Error("Unsupported review claims");
  for (const theme of result.practice_themes) {
    if (
      !theme.supporting_plies.length ||
      theme.supporting_plies.some(
        (ply) =>
          !reviews
            .find((item) => item.ply === ply)
            ?.proofs.some((proof) => proofTheme[proof.motif] === theme.name),
      )
    )
      throw new Error("Unsupported practice theme");
  }
  for (const moment of result.critical_moments) {
    const match = reviews.find((item) => item.ply === moment.ply);
    if (
      !match ||
      moment.expected_loss <= 0 ||
      match.mover !== moment.mover ||
      match.classification.base_label !== moment.label ||
      match.classification.expected_loss !== moment.expected_loss
    )
      throw new Error("Invalid critical moment");
  }
}

export function validateReview(
  reviews: Review[],
  result: Summary | null,
  lines: components["schemas"]["MoveEvidence"][],
  mode: "quick" | "deep",
  state: components["schemas"]["AnalysisResponse"]["state"],
  total: number,
): void {
  if (!result && reviews.length === 0) return;
  if (
    !result ||
    reviews.length !== lines.length ||
    result.coverage.total_plies !== total ||
    result.coverage.analyzed_plies !== lines.length ||
    result.is_final !== (state === "completed") ||
    result.coverage.classified_plies !==
      reviews.filter(
        (item) => item.classification.base_label !== "unclassified",
      ).length
  )
    throw new Error("Invalid classification coverage");
  if (
    !result.is_final &&
    (result.game_conclusions.length ||
      result.critical_moments.length ||
      result.practice_themes.length)
  )
    throw new Error("Incomplete analysis cannot contain final conclusions");
  if (
    reviews.some(
      (item, index) =>
        item.ply !== lines[index]?.ply ||
        item.mover !== lines[index]?.mover ||
        (item.classification.base_label !== "unclassified" &&
          (lines[index]?.status !== "usable" ||
            lines[index]?.best[0]?.wdl == null ||
            lines[index]?.best[0]?.bounded ||
            lines[index]?.played.bounded ||
            (item.classification.base_label === "best" &&
              lines[index]?.best[0]?.pv[0]?.uci !== lines[index]?.played_uci) ||
            lines[index]?.played.wdl == null ||
            item.classification.expected_loss !==
              lines[index]?.expected_loss)) ||
        item.provisional !== (mode === "quick") ||
        item.classification.policy_version !== "v2",
    )
  )
    throw new Error("Classification belongs to another move");
  reviews.forEach((item, index) => {
    const evidence = lines[index];
    if (!evidence) throw new Error("Missing badge evidence");
    validateProofs(item, evidence, mode);
  });
  validateSummary(result, reviews);
}
