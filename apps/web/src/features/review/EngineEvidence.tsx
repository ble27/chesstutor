import type { Evidence } from "../../api/analysisEvidence";
import type { components } from "../../api/generated";

type Score =
  components["schemas"]["CentipawnScore"] | components["schemas"]["MateScore"];

function formatScore(score: Score): string {
  if (score.kind === "mate")
    return `${score.moves < 0 ? "-" : ""}M${Math.abs(score.moves)}`;
  return `${score.centipawns >= 0 ? "+" : ""}${(score.centipawns / 100).toFixed(1)}`;
}

export function EngineEvidence({ evidence }: { evidence: Evidence }) {
  const best = evidence.best[0];
  if (!best) return null;
  return (
    <div className="engine-evidence">
      <p>Before selected move · Position ply {evidence.before_ply}</p>
      <p>Best move: {best.pv[0]?.san}</p>
      <p>White evaluation: {formatScore(best.score)}</p>
      <p>Played move, White evaluation: {formatScore(evidence.played.score)}</p>
      {evidence.status !== "usable" && (
        <p>
          Evidence is {evidence.status}; no move-quality conclusion is
          available.
        </p>
      )}
      <ol aria-label="Engine variations">
        {evidence.best.map((line, index) => (
          <li key={index}>
            <strong>{formatScore(line.score)}</strong> · Depth {line.depth} ·{" "}
            {line.time_ms}ms
            <br />
            {line.pv.map((move) => move.san).join(" ")}
          </li>
        ))}
      </ol>
      {evidence.claimable_draw_before && (
        <p>A draw was claimable before this move.</p>
      )}
      {evidence.automatic_result_after && (
        <p>
          Automatic result after the move: {evidence.automatic_result_after} (
          {evidence.automatic_reason_after}).
        </p>
      )}
    </div>
  );
}
