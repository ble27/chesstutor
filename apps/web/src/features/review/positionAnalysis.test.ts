import { expect, it } from "vitest";
import { completedAnalysis } from "../../testFixtures/analysis";
import { imported } from "../../testFixtures/discovery";
import { positionAnalysis } from "./positionAnalysis";
import {
  analysisGame,
  positionEvidence,
} from "../../testFixtures/positionAnalysis";

const evidence = completedAnalysis.evidence[0];
if (!evidence) throw new Error("Missing fixture");

it("selects unrestricted root evidence for the displayed initial board", () => {
  const view = positionAnalysis(imported, 0, [evidence]);
  expect(view?.kind).toBe("position");
  expect(view?.score).toEqual(evidence.best[0]?.score);
});

it("uses only the played-line score after the last move, without pre-move alternatives", () => {
  const view = positionAnalysis(imported, 1, [evidence]);
  expect(view?.kind).toBe("played");
  expect(view?.score).toEqual(evidence.played.score);
  expect(view?.lines).toEqual([]);
});

it("clears missing or mismatched evidence instead of retaining a score", () => {
  expect(positionAnalysis(imported, 1, [])).toBeNull();
  expect(
    positionAnalysis(imported, 0, [
      { ...evidence, root_fen: imported.positions[1]?.fen ?? "" },
    ]),
  ).toBeNull();
});

it("preserves the engine's mate score and evidence status", () => {
  const mate = {
    ...evidence,
    status: "unstable" as const,
    played: {
      ...evidence.played,
      score: { kind: "mate" as const, moves: -3, pov: "white" as const },
    },
  };
  const view = positionAnalysis(imported, 1, [mate]);
  expect(view?.score).toEqual(mate.played.score);
  expect(view?.status).toBe("unstable");
});

it("prefers following-root evidence through White and Black plies and restores older evaluations", () => {
  for (const [ply, index] of [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 2],
    [2, 2],
    [1, 1],
    [0, 0],
  ]) {
    if (ply === undefined || index === undefined)
      throw new Error("Invalid test step");
    expect(
      positionAnalysis(analysisGame, ply, positionEvidence)?.score,
    ).toEqual(positionEvidence[index]?.best[0]?.score);
  }
});

it("preserves only terminal information for the displayed position", () => {
  const draw = {
    ...evidence,
    claimable_draw_before: true,
    automatic_result_after: "1/2-1/2",
    automatic_reason_after: "stalemate",
  };
  expect(positionAnalysis(imported, 0, [draw])).toMatchObject({
    claimableDraw: true,
    result: null,
  });
  expect(positionAnalysis(imported, 1, [draw])).toMatchObject({
    result: "1/2-1/2",
    reason: "stalemate",
  });
});
