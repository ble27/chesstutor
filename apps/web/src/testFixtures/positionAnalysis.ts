import type { Evidence } from "../api/analysisEvidence";
import { completedAnalysis } from "./analysis";
import { replayFixtures } from "./replay";

const opening = replayFixtures.find((fixture) => fixture.name === "opening");
const template = completedAnalysis.evidence[0];
if (!opening || !template) throw new Error("Missing analysis test fixtures");

export const analysisGame = {
  ...opening.game,
  positions: opening.game.positions.slice(0, 4),
};

// Synthetic engine responses for deterministic tests; never used by the application.
export const positionEvidence: Evidence[] = analysisGame.positions
  .slice(1)
  .map((position, index) => {
    const root = analysisGame.positions[index];
    if (!root || !position.uci || !position.san)
      throw new Error("Incomplete move fixture");
    const mover: Evidence["mover"] =
      root.fen.split(" ")[1] === "w" ? "white" : "black";
    const centipawns = [120, -35, 18][index];
    if (centipawns === undefined) throw new Error("Missing test score");
    const line: Evidence["played"] = {
      ...template.played,
      score: { kind: "cp" as const, centipawns, pov: "white" as const },
      mover_score: {
        kind: "cp" as const,
        centipawns: mover === "white" ? centipawns : -centipawns,
        pov: mover,
      },
      wdl: null,
      pv: [{ san: position.san, uci: position.uci, fen: position.fen }],
    };
    return {
      ...template,
      ply: position.ply,
      before_ply: index,
      root_fen: root.fen,
      mover,
      played_uci: position.uci,
      best: [line],
      played: line,
    };
  });

export const positionJob = {
  ...completedAnalysis,
  total_plies: 3,
  completed_plies: 3,
  evidence: positionEvidence,
};
