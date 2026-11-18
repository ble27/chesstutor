import type { components } from "./generated";
import type { Game } from "./discoveryValidation";
import { ApiError, request } from "./client";
import { array, flag, object, text } from "./analysisFields";
import { positionFen } from "./replayValidation";
import { engineLine } from "./analysisEvidence";
type RawLine = components["schemas"]["BrowserLine"];
export type SandboxPosition = components["schemas"]["SandboxResponse"];
const uci = (value: unknown) => {
  const move = text(value, 5);
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
    throw new Error("Invalid move");
  return move;
};
export function parseSandbox(input: unknown): SandboxPosition {
  const value = object(input);
  if (value.trust !== "client_unverified")
    throw new Error("Invalid local trust");
  const result = value.result;
  if (
    result !== null &&
    result !== "1-0" &&
    result !== "0-1" &&
    result !== "1/2-1/2"
  )
    throw new Error("Invalid result");
  return {
    trust: "client_unverified",
    fen: positionFen(text(value.fen)),
    initial_fen: positionFen(text(value.initial_fen)),
    moves: array(value.moves, 400).map(uci),
    legal_moves: array(value.legal_moves, 218).map(uci),
    positions: array(value.positions, 100).map((input) => {
      const p = object(input);
      return {
        fen: positionFen(text(p.fen)),
        san: text(p.san, 32),
        uci: uci(p.uci),
      };
    }),
    result,
    claimable_draw: flag(value.claimable_draw),
    line: value.line === null ? null : engineLine(value.line),
  };
}
export async function sandboxPosition(
  game: Game,
  rootPly: number,
  branch: readonly string[],
  signal: AbortSignal,
  line?: RawLine,
): Promise<SandboxPosition> {
  const validate = (input: unknown) => {
    const position = parseSandbox(input);
    const expected = [
      ...game.positions.slice(1, rootPly + 1).map((p) => p.uci),
      ...branch,
    ];
    if (
      position.initial_fen !== game.initial_fen ||
      JSON.stringify(position.moves) !== JSON.stringify(expected) ||
      position.positions.length !== branch.length ||
      position.fen !==
        (position.positions.at(-1)?.fen ?? game.positions[rootPly]?.fen) ||
      (position.line?.pv[0] &&
        !position.legal_moves.includes(position.line.pv[0].uci))
    )
      throw new Error("Mismatched sandbox position");
    return position;
  };
  const send = () =>
    request(`/api/v1/games/${game.game.id}/sandbox`, validate, {
      method: "POST",
      signal,
      timeoutMs: 10000,
      body: JSON.stringify({
        game_version: game.version,
        pgn_hash: game.pgn_hash,
        root_ply: rootPly,
        branch,
        ...(line ? { line } : {}),
      }),
    });
  try {
    return await send();
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === "session_required" &&
      error.status === 409
    )
      return send();
    throw error;
  }
}
