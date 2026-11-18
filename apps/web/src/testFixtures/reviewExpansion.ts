import type { Analysis } from "../api/analysis";
import type { Lessons } from "../api/coaching";
import { analysisGame, positionJob } from "./positionAnalysis";

export const expansionGame = analysisGame;
export const expansionJob: Analysis = {
  ...positionJob,
  evidence: positionJob.evidence.map((move) => ({
    ...move,
    status: move.ply === 3 ? "insufficient" : "usable",
    expected_loss: move.ply === 3 ? null : 0,
    best: move.best.map((line) => ({
      ...line,
      wdl: { wins: 600, draws: 300, losses: 100, pov: move.mover },
    })),
    played: {
      ...move.played,
      wdl: { wins: 600, draws: 300, losses: 100, pov: move.mover },
    },
  })),
  classifications: positionJob.evidence.map((move) => ({
    ply: move.ply,
    mover: move.mover,
    provisional: true,
    badges: [],
    proofs: [],
    classification: {
      base_label: move.ply === 3 ? "unclassified" : "best",
      expected_loss: move.ply === 3 ? null : 0,
      policy_version: "v3",
    },
  })),
  accuracy: {
    version: "logistic-v1",
    complete: false,
    players: {
      white: { accuracy: 99.9999, scored_plies: 1, total_plies: 2 },
      black: { accuracy: 99.9999, scored_plies: 1, total_plies: 1 },
    },
    moves: [
      { ply: 1, mover: "white", accuracy: 99.9999 },
      { ply: 2, mover: "black", accuracy: 99.9999 },
    ],
  },
  summary: {
    players: {
      white: { counts: { best: 1, unclassified: 1 }, average_expected_loss: 0 },
      black: { counts: { best: 1 }, average_expected_loss: 0 },
    },
    coverage: { analyzed_plies: 3, classified_plies: 2, total_plies: 3 },
    is_final: true,
    critical_moments: [],
    practice_themes: [],
    game_conclusions: [],
  },
};

export const expansionNotes: Lessons = {
  analysis_id: expansionJob.id,
  complete: true,
  level: "beginner",
  lessons: [
    {
      ply: 1,
      kind: "best",
      text: "Your pawn moved from e2 to e4. Best move: you chose the engine's strongest checked option.",
      evidence_ids: [],
      alternatives: [],
      arrows: [],
    },
    {
      ply: 2,
      kind: "best",
      text: "Your pawn moved from e7 to e5. Best move: you chose the engine's strongest checked option.",
      evidence_ids: [],
      alternatives: [],
      arrows: [],
    },
    {
      ply: 3,
      kind: "unclassified",
      text: "Your knight moved from g1 to f3. Unclassified: there is not enough reliable engine evidence. Run Deep for a closer look.",
      evidence_ids: [],
      alternatives: [],
      arrows: [],
    },
  ],
};
