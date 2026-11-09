import { describe, expect, it } from "vitest";
import { imported, summary } from "../../testFixtures/discovery";
import { gameOutcome, moveCount } from "./gamePresentation";

describe("game library evidence", () => {
  it("reports explicit results without guessing a winner from unknown data", () => {
    expect(gameOutcome(summary)).toEqual({
      score: "1–0",
      description: "alice won",
      winner: "alice",
    });
    expect(
      gameOutcome({
        ...summary,
        result: "1/2-1/2",
        white: { ...summary.white, result: "agreed" },
        black: { ...summary.black, result: "agreed" },
      }).score,
    ).toBe("½–½");
    expect(
      gameOutcome({
        ...summary,
        result: null,
        black: { ...summary.black, result: "win" },
      }).winner,
    ).toBeNull();
    expect(
      gameOutcome({ ...summary, eligibility: "unfinished_game" }).winner,
    ).toBeNull();
  });
  it("counts full moves from validated played positions including black-to-move setup games", () => {
    expect(moveCount(imported)).toBe(1);
    expect(
      moveCount({
        ...imported,
        initial_fen: imported.initial_fen.replace(" w ", " b "),
      }),
    ).toBe(1);
    expect(
      moveCount({
        ...imported,
        positions: [...imported.positions, ...imported.positions.slice(1)],
      }),
    ).toBe(1);
    expect(
      moveCount({
        ...imported,
        initial_fen: imported.initial_fen.replace(" w ", " b "),
        positions: [...imported.positions, ...imported.positions.slice(1)],
      }),
    ).toBe(2);
  });
});
