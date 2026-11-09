import type { components } from "../api/generated";
import { imported } from "./discovery";

export const queuedAnalysis: components["schemas"]["AnalysisResponse"] = {
  id: "19d55620-670a-434b-8ae0-8d2d6be07c11",
  game_id: imported.game.id,
  game_version: 1,
  mode: "quick",
  state: "queued",
  completed_plies: 0,
  total_plies: 1,
  attempts: 0,
  created_at: "2026-11-02T12:00:00Z",
  updated_at: "2026-11-02T12:00:00Z",
  deadline_at: null,
  error_code: null,
  dispatch_pending: true,
  cached: false,
  can_cancel: true,
  engine: {
    version: "17.1",
    binary_sha256: "a".repeat(64),
    nnue: "embedded",
    options: { Threads: 1, Hash: 128, UCI_ShowWDL: true },
  },
  evidence: [],
};

export const completedAnalysis: components["schemas"]["AnalysisResponse"] = {
  ...queuedAnalysis,
  state: "completed",
  completed_plies: 1,
  attempts: 1,
  dispatch_pending: false,
  can_cancel: false,
  evidence: [
    {
      ply: 1,
      before_ply: 0,
      root_fen: imported.initial_fen,
      mover: "white",
      played_uci: "e2e4",
      status: "usable",
      expected_loss: 0,
      claimable_draw_before: false,
      automatic_result_after: null,
      automatic_reason_after: null,
      best: [
        {
          score: { kind: "cp", centipawns: 120, pov: "white" },
          mover_score: { kind: "cp", centipawns: 120, pov: "white" },
          wdl: { wins: 600, draws: 300, losses: 100, pov: "white" },
          depth: 8,
          nodes: 200,
          time_ms: 100,
          bounded: false,
          pv: [
            { uci: "e2e4", san: "e4", fen: imported.positions[1]?.fen ?? "" },
          ],
        },
      ],
      played: {
        score: { kind: "cp", centipawns: 120, pov: "white" },
        mover_score: { kind: "cp", centipawns: 120, pov: "white" },
        wdl: { wins: 600, draws: 300, losses: 100, pov: "white" },
        depth: 8,
        nodes: 200,
        time_ms: 100,
        bounded: false,
        pv: [{ uci: "e2e4", san: "e4", fen: imported.positions[1]?.fen ?? "" }],
      },
    },
  ],
};

const classifiedEvidence = completedAnalysis.evidence[0];
if (!classifiedEvidence || !classifiedEvidence.best[0])
  throw new Error("Missing analysis fixture");
const runnerUp = {
  ...classifiedEvidence.best[0],
  score: { kind: "cp", centipawns: 0, pov: "white" },
  mover_score: { kind: "cp", centipawns: 0, pov: "white" },
  wdl: { wins: 300, draws: 400, losses: 300, pov: "white" },
  pv: [
    {
      uci: "d2d4",
      san: "d4",
      fen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
    },
  ],
} satisfies components["schemas"]["EngineLine"];

export const verifiedGreatAnalysis: components["schemas"]["AnalysisResponse"] =
  {
    ...completedAnalysis,
    mode: "deep",
    evidence: [
      { ...classifiedEvidence, best: [...classifiedEvidence.best, runnerUp] },
    ],
    classifications: [
      {
        ply: 1,
        mover: "white",
        provisional: false,
        badges: ["great"],
        classification: {
          base_label: "best",
          expected_loss: 0,
          policy_version: "v2",
        },
        proofs: [
          {
            id: "v2:1:great",
            badge: "great",
            motif: "unique_move",
            ply: 1,
            root_fen: classifiedEvidence.root_fen,
            line: runnerUp,
            reserved_ms: 850,
            offered_material_points: 0,
            verified_followup_plies: 1,
            expected_score_after_reply: 0.5,
            policy_version: "v2",
          },
        ],
      },
    ],
    summary: {
      players: {
        white: { counts: { best: 1 }, average_expected_loss: 0 },
        black: { counts: {}, average_expected_loss: null },
      },
      coverage: { analyzed_plies: 1, classified_plies: 1, total_plies: 1 },
      is_final: true,
      game_conclusions: [],
      critical_moments: [],
      practice_themes: [{ name: "calculation", supporting_plies: [1] }],
    },
  };
