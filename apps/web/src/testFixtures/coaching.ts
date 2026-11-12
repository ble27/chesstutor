import type { components } from "../api/generated";
import { completedAnalysis } from "./analysis";
import { imported } from "./discovery";

type Lessons = components["schemas"]["LessonsResponse"];
type Coach = components["schemas"]["CoachResponse"];

const rootFen = "6k1/8/8/8/6b1/8/8/3R2K1 w - - 0 1";
const playedFen = "6k1/8/8/8/6b1/8/8/3R3K b - - 1 1";
const bestFen = "6k1/8/8/8/3R2b1/8/8/6K1 b - - 1 1";
const base = completedAnalysis.evidence[0];
if (!base || !base.best[0]) throw new Error("Missing analysis fixture");

export const guidanceGame = {
  ...imported,
  initial_fen: rootFen,
  positions: [
    { ply: 0, fen: rootFen, san: null, uci: null },
    { ply: 1, fen: playedFen, san: "Kh1", uci: "g1h1" },
  ],
};

export const guidanceAnalysis = {
  ...completedAnalysis,
  evidence: [
    {
      ...base,
      root_fen: rootFen,
      played_uci: "g1h1",
      played: {
        ...base.played,
        pv: [{ uci: "g1h1", san: "Kh1", fen: playedFen }],
      },
      best: [
        { ...base.best[0], pv: [{ uci: "d1d4", san: "Rd4", fen: bestFen }] },
      ],
    },
  ],
};

export const lessons: Lessons = {
  analysis_id: completedAnalysis.id,
  level: "beginner",
  complete: true,
  lessons: [
    {
      ply: 1,
      kind: "mistake",
      text: "This move is a mistake because it leaves your rook on d1 undefended, so the opponent's bishop on g4 can capture it.",
      evidence_ids: ["hanging_piece-1-g4-d1"],
      alternatives: [
        {
          rank: 1,
          uci: "d1d4",
          text: "Consider moving your rook from d1 to d4, which keeps your pieces protected.",
        },
      ],
      arrows: [
        {
          kind: "played",
          rank: 0,
          from_square: "g1",
          to_square: "h1",
          uci: "g1h1",
        },
        {
          kind: "suggested",
          rank: 1,
          from_square: "d1",
          to_square: "d4",
          uci: "d1d4",
        },
      ],
    },
  ],
};

export const answer: Coach = {
  status: "grounded",
  text: "Your bishop on c4 can capture the opponent's queen on d5, and nothing protects it. Free pieces are worth taking.",
  player_color: "white",
  blocks: [
    {
      template_id: "hanging_opportunity",
      evidence_ids: ["hanging_piece-1-c4-d5"],
    },
  ],
  evidence_ids: ["hanging_piece-1-c4-d5"],
  continuation_uci: [],
  arrows: [],
  suggest_deep: false,
  scope: "position",
  supporting_plies: [],
  practice_themes: [],
};

export const refusal: Coach = {
  ...answer,
  status: "refused",
  text: "I can help with chess moves, positions, rules, and improvement. Choose a chess question about this game.",
  blocks: [{ template_id: "refusal", evidence_ids: [] }],
  evidence_ids: [],
};
