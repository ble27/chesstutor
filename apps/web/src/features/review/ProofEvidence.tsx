import { isRecord } from "../../api/validation";

type Badge = "miss" | "great" | "brilliant";
type ProofView = { id: string; badge: Badge; motif: string; line: string };
type Theme = { name: string; supporting_plies: number[] };

function proofView(
  input: unknown,
  ply: number,
  badges: unknown[],
): ProofView | null {
  if (!isRecord(input) || !isRecord(input.line)) return null;
  const { badge, motif, id } = input;
  if (badge !== "miss" && badge !== "great" && badge !== "brilliant")
    return null;
  if (
    typeof id !== "string" ||
    input.ply !== ply ||
    id !== `v1:${ply}:${badge}` ||
    !badges.includes(badge)
  )
    return null;
  if (typeof motif !== "string" || !/^[a-z_]{1,64}$/.test(motif)) return null;
  const steps: unknown = input.line.pv;
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 300)
    return null;
  const moves: string[] = [];
  for (const step of steps) {
    if (
      !isRecord(step) ||
      typeof step.san !== "string" ||
      !step.san ||
      step.san.length > 32
    )
      return null;
    moves.push(step.san);
  }
  return { id, badge, motif, line: moves.join(" ") };
}

// The analysis API validates the chess proof before it reaches this view.
export function ProofEvidence({
  move,
  themes,
}: {
  move: unknown;
  themes: readonly Theme[];
}) {
  if (
    !isRecord(move) ||
    typeof move.ply !== "number" ||
    !Array.isArray(move.badges) ||
    !Array.isArray(move.proofs)
  )
    return null;
  const ply = move.ply;
  const badges = move.badges;
  if (move.proofs.length > 1) return null;
  const proofs = move.proofs
    .map((item: unknown) => proofView(item, ply, badges))
    .filter((item): item is ProofView => item !== null);
  if (!proofs.length) return null;
  return (
    <section aria-label="Checked badge evidence">
      <p>
        Brilliant is a heuristic; badges require checked supporting evidence.
      </p>
      {proofs.map((proof) => (
        <div key={proof.id}>
          <p>
            {proof.badge === "brilliant"
              ? "Brilliant (heuristic)"
              : proof.badge === "great"
                ? "Great"
                : "Miss"}
          </p>
          <p>Checked supporting line: {proof.line}</p>
          <p>
            {proof.badge === "miss" ? "Missed opportunity" : "Verification"}:{" "}
            {proof.motif.replaceAll("_", " ")}
          </p>
        </div>
      ))}
      {themes
        .filter((theme) => theme.supporting_plies.includes(ply))
        .map((theme) => (
          <p key={theme.name}>Practice: {theme.name}</p>
        ))}
    </section>
  );
}
