import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";

export type PositionAnalysis = {
  kind: "position" | "played";
  score: Evidence["played"]["score"];
  lines: Evidence["best"];
  status: Evidence["status"];
  claimableDraw: boolean;
  result: string | null;
  reason: string | null;
};

export function positionAnalysis(
  game: Game,
  selectedPly: number,
  evidence: readonly Evidence[],
): PositionAnalysis | null {
  const root = evidence.find(
    (item) =>
      item.before_ply === selectedPly &&
      item.root_fen === game.positions[selectedPly]?.fen,
  );
  const best = root?.best[0];
  if (root && best)
    return {
      kind: "position",
      score: best.score,
      lines: root.best,
      status: root.status,
      claimableDraw: root.claimable_draw_before,
      result: null,
      reason: null,
    };
  const played = evidence.find(
    (item) =>
      item.ply === selectedPly &&
      item.root_fen === game.positions[selectedPly - 1]?.fen &&
      item.played_uci === game.positions[selectedPly]?.uci,
  );
  return played
    ? {
        kind: "played",
        score: played.played.score,
        lines: [],
        status: played.status,
        claimableDraw: false,
        result: played.automatic_result_after,
        reason: played.automatic_reason_after,
      }
    : null;
}
