import type { components } from "./generated";
import { engineLine } from "./analysisEvidence";
import { integer, object, text } from "./analysisFields";

type Proof = components["schemas"]["BadgeProof"];
type Review = components["schemas"]["ReviewedMove"];
type Evidence = components["schemas"]["MoveEvidence"];

export function badgeProof(input: unknown): Proof {
  const value = object(input),
    badge = value.badge,
    motif = value.motif;
  if (badge !== "miss" && badge !== "great" && badge !== "brilliant")
    throw new Error("Invalid badge");
  if (
    motif !== "forced_mate" &&
    motif !== "material_win" &&
    motif !== "unique_move" &&
    motif !== "sacrifice"
  )
    throw new Error("Invalid badge motif");
  const expected = value.expected_score_after_reply;
  if (
    expected !== null &&
    (typeof expected !== "number" ||
      !Number.isFinite(expected) ||
      expected < 0 ||
      expected > 1)
  )
    throw new Error("Invalid checked expected score");
  return {
    id: text(value.id, 80),
    badge,
    motif,
    ply: integer(value.ply, 1, 300),
    policy_version: text(value.policy_version, 40),
    root_fen: text(value.root_fen, 100),
    line: engineLine(value.line),
    reserved_ms: integer(value.reserved_ms, 1, 10000),
    offered_material_points: integer(value.offered_material_points, 0, 39),
    verified_followup_plies: integer(value.verified_followup_plies, 1, 300),
    expected_score_after_reply: expected,
    survival_line:
      value.survival_line == null ? null : engineLine(value.survival_line),
  };
}
function expected(line: Evidence["played"], mover: Review["mover"]): number {
  if (!line.wdl || line.bounded) throw new Error("Insufficient badge evidence");
  const wdl = line.wdl,
    value = (wdl.wins + 0.5 * wdl.draws) / (wdl.wins + wdl.draws + wdl.losses);
  return wdl.pov === mover ? value : 1 - value;
}
export const proofTheme: Record<Proof["motif"], string> = {
  forced_mate: "mate_threat",
  material_win: "material_tactics",
  unique_move: "calculation",
  sacrifice: "sacrifices",
};

function validateBrilliant(
  proof: Proof,
  review: Review,
  evidence: Evidence,
  mode: "quick" | "deep",
): void {
  const survival = proof.survival_line,
    base = review.classification.base_label;
  const capturedSquare = proof.line.pv[0]?.uci.slice(2, 4);
  const originalSquare =
    capturedSquare === evidence.played_uci.slice(2, 4)
      ? evidence.played_uci.slice(0, 2)
      : capturedSquare;
  if (
    mode !== "deep" ||
    (base !== "best" && base !== "good") ||
    review.classification.expected_loss === null ||
    review.classification.expected_loss >= 0.02 ||
    proof.motif !== "sacrifice" ||
    proof.root_fen !== evidence.played.pv[0]?.fen ||
    proof.offered_material_points < 2 ||
    proof.line.pv.length < 6 ||
    expected(proof.line, review.mover) < 0.5 ||
    expected(evidence.played, review.mover) < 0.5 ||
    proof.expected_score_after_reply == null ||
    proof.expected_score_after_reply < 0.5 ||
    !survival ||
    survival.pv.length < 6 ||
    expected(survival, review.mover) < 0.5 ||
    survival.pv[0]?.uci.slice(0, 2) !== originalSquare ||
    proof.reserved_ms < 1500
  )
    throw new Error("Unsupported sacrifice or already-lost exclusion");
}
function validateGreat(
  proof: Proof,
  review: Review,
  evidence: Evidence,
  mode: "quick" | "deep",
): void {
  const best = evidence.best[0];
  if (!best || evidence.best.length < 2) throw new Error("Missing runner-up");
  const bestExpected = expected(best, review.mover);
  const candidates = evidence.best.map((line) => ({
    uci: line.pv[0]?.uci,
    loss: bestExpected - expected(line, review.mover),
  }));
  const runner = candidates.slice(1).sort((a, b) => a.loss - b.loss)[0];
  if (
    mode !== "deep" ||
    review.classification.base_label !== "best" ||
    proof.motif !== "unique_move" ||
    candidates.filter((item) => item.loss < 0.05 - 1e-9).length !== 1 ||
    !runner ||
    runner.loss < 0.15 - 1e-9 ||
    runner.uci !== proof.line.pv[0]?.uci ||
    bestExpected - expected(proof.line, review.mover) < 0.15 - 1e-9
  )
    throw new Error("Unverified runner-up");
}
function validateMiss(proof: Proof, review: Review, evidence: Evidence): void {
  const base = review.classification.base_label,
    loss = review.classification.expected_loss;
  if (
    loss === null ||
    loss < 0.1 ||
    (base !== "mistake" && base !== "blunder") ||
    expected(proof.line, review.mover) -
      expected(evidence.played, review.mover) <
      0.1 - 1e-9 ||
    proof.line.pv[0]?.uci !== evidence.best[0]?.pv[0]?.uci ||
    (proof.motif === "material_win" && evidence.played.pv.length < 6) ||
    (proof.motif !== "forced_mate" && proof.motif !== "material_win")
  )
    throw new Error("Unsupported missed opportunity");
}
export function validateProofs(
  review: Review,
  evidence: Evidence,
  mode: "quick" | "deep",
): void {
  if (review.badges.length !== review.proofs.length || review.badges.length > 1)
    throw new Error("Missing or conflicting badge proofs");
  for (const proof of review.proofs) {
    const rootMover =
      proof.badge === "brilliant"
        ? review.mover === "white"
          ? "black"
          : "white"
        : review.mover;
    if (
      proof.ply !== review.ply ||
      proof.id !== `v1:${review.ply}:${proof.badge}` ||
      proof.policy_version !== "v1" ||
      !review.badges.includes(proof.badge) ||
      proof.reserved_ms < (mode === "deep" ? 750 : 100) ||
      proof.verified_followup_plies !== proof.line.pv.length ||
      evidence.status !== "usable" ||
      proof.line.mover_score.pov !== rootMover ||
      proof.line.wdl?.pov !== rootMover
    )
      throw new Error("Invalid badge proof identity");
    if (proof.badge === "brilliant")
      validateBrilliant(proof, review, evidence, mode);
    else {
      if (proof.root_fen !== evidence.root_fen)
        throw new Error("Wrong badge root");
      if (proof.badge === "great") validateGreat(proof, review, evidence, mode);
      else validateMiss(proof, review, evidence);
    }
  }
}
