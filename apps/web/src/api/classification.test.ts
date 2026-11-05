import { expect, it } from "vitest";
import { completedAnalysis } from "../testFixtures/analysis";
import { parseAnalysis } from "./analysis";

const classified = {
  ...completedAnalysis,
  classifications: [
    {
      ply: 1,
      mover: "white",
      classification: {
        base_label: "best",
        expected_loss: 0,
        policy_version: "v1",
      },
      badges: [],
      provisional: true,
    },
  ],
  summary: {
    players: {
      white: { counts: { best: 1 }, average_expected_loss: 0 },
      black: { counts: {}, average_expected_loss: null },
    },
    coverage: { analyzed_plies: 1, classified_plies: 1, total_plies: 1 },
    is_final: true,
    game_conclusions: [],
    critical_moments: [],
    practice_themes: [],
  },
};

it("accepts classifications attached to matching engine evidence", () => {
  expect(
    parseAnalysis(classified).classifications?.[0]?.classification.base_label,
  ).toBe("best");
});

it.each([
  {
    ...classified,
    classifications: [{ ...classified.classifications[0], ply: 2 }],
  },
  {
    ...classified,
    classifications: [{ ...classified.classifications[0], mover: "black" }],
  },
  {
    ...classified,
    classifications: [{ ...classified.classifications[0], provisional: false }],
  },
  { ...classified, summary: { ...classified.summary, is_final: false } },
  {
    ...classified,
    summary: {
      ...classified.summary,
      coverage: { ...classified.summary.coverage, classified_plies: 0 },
    },
  },
  {
    ...classified,
    classifications: [
      { ...classified.classifications[0], badges: ["brilliant"] },
    ],
  },
])(
  "rejects classification responses with unsupported or mismatched evidence %#",
  (payload) => {
    expect(() => parseAnalysis(payload)).toThrow();
  },
);

it("does not render a confident label from unstable engine evidence", () => {
  const evidence = completedAnalysis.evidence[0];
  if (!evidence) throw new Error("Missing fixture");
  expect(() =>
    parseAnalysis({
      ...classified,
      evidence: [{ ...evidence, status: "unstable", expected_loss: null }],
    }),
  ).toThrow();
});

it("rejects a classification loss that contradicts its engine evidence", () => {
  const item = classified.classifications[0];
  if (!item) throw new Error("Missing fixture");
  expect(() =>
    parseAnalysis({
      ...classified,
      classifications: [
        {
          ...item,
          classification: { ...item.classification, expected_loss: 0.2 },
        },
      ],
    }),
  ).toThrow();
});

it("rejects final conclusions in a partial analysis", () => {
  expect(() =>
    parseAnalysis({
      ...classified,
      state: "running",
      total_plies: 2,
      summary: {
        ...classified.summary,
        is_final: false,
        critical_moments: [
          { ply: 1, mover: "white", label: "best", expected_loss: 0 },
        ],
        coverage: { ...classified.summary.coverage, total_plies: 2 },
      },
    }),
  ).toThrow();
});

it("rejects player counts that contradict the classified moves", () => {
  expect(() =>
    parseAnalysis({
      ...classified,
      summary: {
        ...classified.summary,
        players: {
          ...classified.summary.players,
          white: { counts: { blunder: 1 }, average_expected_loss: 0 },
        },
      },
    }),
  ).toThrow();
});

it("rejects a critical moment attributed to the wrong player", () => {
  expect(() =>
    parseAnalysis({
      ...classified,
      summary: {
        ...classified.summary,
        critical_moments: [
          { ply: 1, mover: "black", label: "best", expected_loss: 0 },
        ],
      },
    }),
  ).toThrow();
});

it.each(["best", "played"] as const)(
  "rejects confident labels for bounded %s search",
  (which) => {
    const evidence = completedAnalysis.evidence[0];
    if (!evidence || !evidence.best[0]) throw new Error("Missing fixture");
    const bounded =
      which === "best"
        ? { ...evidence, best: [{ ...evidence.best[0], bounded: true }] }
        : { ...evidence, played: { ...evidence.played, bounded: true } };
    expect(() =>
      parseAnalysis({ ...classified, evidence: [bounded] }),
    ).toThrow();
  },
);

it("rejects Best when the played move differs from the engine's top choice", () => {
  const evidence = completedAnalysis.evidence[0];
  if (!evidence || !evidence.best[0] || !evidence.best[0].pv[0])
    throw new Error("Missing fixture");
  const best = {
    ...evidence.best[0],
    pv: [{ ...evidence.best[0].pv[0], uci: "d2d4", san: "d4" }],
  };
  expect(() =>
    parseAnalysis({ ...classified, evidence: [{ ...evidence, best: [best] }] }),
  ).toThrow();
});

it("does not call a zero-loss move a critical moment", () => {
  expect(() =>
    parseAnalysis({
      ...classified,
      summary: {
        ...classified.summary,
        critical_moments: [
          { ply: 1, mover: "white", label: "best", expected_loss: 0 },
        ],
      },
    }),
  ).toThrow();
});

it("accepts a verified Deep badge and its evidence-supported practice theme", async () => {
  const { verifiedGreatAnalysis } = await import("../testFixtures/analysis");
  const result = parseAnalysis(verifiedGreatAnalysis);
  expect(result.classifications?.[0]?.badges).toEqual(["great"]);
  expect(result.classifications?.[0]?.proofs[0]?.line.pv[0]?.san).toBe("d4");
  expect(result.summary?.practice_themes[0]?.name).toBe("calculation");
});

it("rejects Great when an initial competing candidate is equally good", async () => {
  const { verifiedGreatAnalysis } = await import("../testFixtures/analysis");
  const item = verifiedGreatAnalysis.evidence[0];
  if (!item || !item.best[0] || !item.best[1])
    throw new Error("Missing fixture");
  const conflicting = { ...item.best[1], wdl: item.best[0].wdl };
  expect(() =>
    parseAnalysis({
      ...verifiedGreatAnalysis,
      evidence: [{ ...item, best: [item.best[0], conflicting] }],
    }),
  ).toThrow();
});
