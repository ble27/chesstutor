import { parseGame } from "../api/discoveryValidation";
import { imported } from "./discovery";
import fixtures from "./replay.json" with { type: "json" };

export const replayFixtures = fixtures.map((fixture) => ({
  name: fixture.name,
  game: parseGame({
    ...imported,
    game: {
      ...imported.game,
      white: { ...imported.game.white, result: fixture.white },
      black: { ...imported.game.black, result: fixture.black },
    },
    initial_fen: fixture.positions[0]?.fen,
    result: fixture.result,
    positions: fixture.positions,
  }),
}));
