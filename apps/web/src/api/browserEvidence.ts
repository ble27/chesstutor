import { request } from "./client";
import { array, object } from "./analysisFields";
import { evidence } from "./analysisEvidence";
import type { Game } from "./discoveryValidation";

export async function validatePositions(
  game: Game,
  positions: unknown[],
  signal: AbortSignal,
) {
  const expected = new Set(positions.map((value) => object(value).ply));
  return request(
    `/api/v1/games/${game.game.id}/browser-evidence`,
    (input) => {
      const value = object(input);
      if (value.trust !== "client_unverified")
        throw new Error("Invalid trust marker");
      const results = array(value.evidence, 8).map(evidence);
      if (
        results.length !== positions.length ||
        new Set(results.map((item) => item.ply)).size !== results.length ||
        results.some(
          (item) =>
            !expected.has(item.ply) ||
            item.root_fen !== game.positions[item.before_ply]?.fen ||
            item.played_uci !== game.positions[item.ply]?.uci,
        )
      )
        throw new Error("Wrong game evidence");
      return results;
    },
    {
      method: "POST",
      body: JSON.stringify({
        game_version: game.version,
        pgn_hash: game.pgn_hash,
        positions,
      }),
      signal,
      timeoutMs: 10000,
    },
  );
}
