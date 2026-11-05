import type { components } from "../api/generated";
import { completedAnalysis } from "./analysis";

type Lessons = components["schemas"]["LessonsResponse"];
type Coach = components["schemas"]["CoachResponse"];

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
