import { expect, it } from "vitest";
import { parseAccuracy, validateAccuracy } from "./accuracy";
const valid = {
  version: "logistic-v1",
  complete: true,
  players: {
    white: { accuracy: 74.2, total_plies: 1, scored_plies: 1 },
    black: { accuracy: null, total_plies: 0, scored_plies: 0 },
  },
  moves: [{ ply: 1, mover: "white", accuracy: 74.2 }],
};
it("reads versioned backend calibration and leaves legacy results unavailable", () => {
  expect(parseAccuracy(undefined)).toBeNull();
  expect(parseAccuracy(valid)).toEqual(valid);
  expect(() =>
    validateAccuracy(parseAccuracy(valid), 1, "completed"),
  ).not.toThrow();
});
it.each([
  { ...valid, version: "unknown" },
  { ...valid, moves: [{ ply: 1, mover: "white", accuracy: 101 }] },
  {
    ...valid,
    players: {
      ...valid.players,
      white: { accuracy: null, total_plies: 1, scored_plies: 1 },
    },
  },
])("rejects invalid calibrated payloads", (input) =>
  expect(() => parseAccuracy(input)).toThrow(),
);
it("rejects mismatched game coverage and duplicate scored plies", () => {
  expect(() =>
    validateAccuracy(parseAccuracy(valid), 2, "completed"),
  ).toThrow();
  expect(() =>
    validateAccuracy(
      parseAccuracy({ ...valid, moves: [...valid.moves, ...valid.moves] }),
      1,
      "completed",
    ),
  ).toThrow();
});
