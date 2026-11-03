import type {
  Archives,
  Games,
  Game,
  Summary,
} from "../api/discoveryValidation";

export const archive: Archives = {
  username: "alice",
  months: ["2026-11", "2026-10"],
  fetched_at: "2026-11-02T12:00:00Z",
  stale: false,
};
export const summary: Summary = {
  id: "381e6db7-0719-5a45-bade-18c73a8b1111",
  source_url: "https://www.chess.com/game/live/1",
  white: { username: "alice", rating: 1200, result: "win" },
  black: { username: "bobby", rating: null, result: "resigned" },
  end_time: "2026-11-01T12:00:00Z",
  time_class: "rapid",
  rules: "chess",
  eligibility: "available",
};
export const listing: Games = {
  games: [summary],
  next_cursor: null,
  fetched_at: archive.fetched_at,
  stale: false,
};
const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const imported: Game = {
  game: summary,
  version: 1,
  pgn_hash: "a".repeat(64),
  initial_fen: initialFen,
  result: "1-0",
  positions: [
    { ply: 0, fen: initialFen, san: null, uci: null },
    {
      ply: 1,
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      san: "e4",
      uci: "e2e4",
    },
  ],
};
