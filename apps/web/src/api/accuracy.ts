import type { components } from "./generated";
import { array, flag, integer, object } from "./analysisFields";

type Accuracy = components["schemas"]["AccuracySummary"];
function percent(input: unknown): number {
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < 0 ||
    input > 100
  )
    throw new Error("Invalid accuracy");
  return input;
}
export function parseAccuracy(input: unknown): Accuracy | null {
  if (input === undefined || input === null) return null;
  const value = object(input);
  if (value.version !== "logistic-v1")
    throw new Error("Unknown accuracy policy");
  const players = object(value.players);
  const parsePlayer = (input: unknown) => {
    const p = object(input);
    const total = integer(p.total_plies, 0, 300);
    const scored = integer(p.scored_plies, 0, total);
    const accuracy = p.accuracy === null ? null : percent(p.accuracy);
    if ((scored === 0) !== (accuracy === null))
      throw new Error("Invalid accuracy coverage");
    return { accuracy, total_plies: total, scored_plies: scored };
  };
  const moves: Accuracy["moves"] = array(value.moves, 300).map((input) => {
    const m = object(input);
    if (m.mover !== "white" && m.mover !== "black")
      throw new Error("Invalid mover");
    return {
      ply: integer(m.ply, 1, 300),
      mover: m.mover,
      accuracy: percent(m.accuracy),
    };
  });
  return {
    version: "logistic-v1",
    complete: flag(value.complete),
    players: {
      white: parsePlayer(players.white),
      black: parsePlayer(players.black),
    },
    moves,
  };
}

export function validateAccuracy(
  accuracy: Accuracy | null,
  total: number,
  state: string,
): void {
  if (!accuracy) return;
  const white = accuracy.players.white,
    black = accuracy.players.black;
  if (!white || !black || white.total_plies + black.total_plies !== total)
    throw new Error("Wrong accuracy totals");
  const seen = new Set<number>();
  for (const move of accuracy.moves) {
    if (move.ply > total || seen.has(move.ply))
      throw new Error("Wrong accuracy move");
    seen.add(move.ply);
  }
  for (const color of ["white", "black"] as const) {
    if (
      accuracy.moves.filter((m) => m.mover === color).length !==
      accuracy.players[color]?.scored_plies
    )
      throw new Error("Wrong scored coverage");
  }
  if (accuracy.complete && (state !== "completed" || seen.size !== total))
    throw new Error("Incomplete final accuracy");
}
