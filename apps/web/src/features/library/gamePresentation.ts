import type { Game, Summary } from "../../api/discoveryValidation";

export function gameOutcome(game: Summary): {
  score: string;
  description: string;
  winner: string | null;
} {
  const unknown = {
    score: "—",
    description: "Result unavailable",
    winner: null,
  };
  if (game.eligibility === "unfinished_game") return unknown;
  if (game.result === "1-0" || game.result === "0-1") {
    const winner =
      game.result === "1-0" ? game.white.username : game.black.username;
    return {
      score: game.result === "1-0" ? "1–0" : "0–1",
      description: `${winner} won`,
      winner,
    };
  }
  if (game.result === "1/2-1/2")
    return { score: "½–½", description: "Draw", winner: null };
  return unknown;
}

export function moveCount(game: Game): number {
  const plies = game.positions.length - 1;
  // Count move-number pairs touched, including games set up with Black to move.
  return Math.ceil(
    (plies + (game.initial_fen.split(" ")[1] === "b" ? 1 : 0)) / 2,
  );
}
