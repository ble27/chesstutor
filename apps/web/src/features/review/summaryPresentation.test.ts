import { expect, it } from "vitest";
import { verifiedGreatAnalysis } from "../../testFixtures/analysis";
import { summaryColumn } from "./summaryPresentation";

const move = verifiedGreatAnalysis.classifications?.[0];
if (!move) throw new Error("Missing classified fixture");

it("counts verified badge labels once rather than counting their underlying base label too", () => {
  const result = summaryColumn(
    { counts: { best: 2, good: 1, mistake: 1 }, average_expected_loss: 0.06 },
    [
      { ...move, badges: ["brilliant"] },
      { ...move, ply: 2, badges: ["great"] },
      {
        ...move,
        ply: 3,
        badges: ["miss"],
        classification: {
          ...move.classification,
          base_label: "mistake",
          expected_loss: 0.24,
        },
      },
      {
        ...move,
        ply: 4,
        badges: [],
        classification: { ...move.classification, base_label: "good" },
      },
    ],
  );
  expect(result.counts).toEqual({ brilliant: 1, great: 1, miss: 1, good: 1 });
  expect(result.total).toBe(4);
  expect(result.scored).toBe(4);
  expect(result.accuracy).toBe("94.0%");
});

it("keeps accuracy unavailable when all reviewed plies are unclassified", () => {
  const result = summaryColumn({
    counts: { unclassified: 2 },
    average_expected_loss: null,
  });
  expect(result.total).toBe(2);
  expect(result.scored).toBe(0);
  expect(result.accuracy).toBe("Unavailable");
});
