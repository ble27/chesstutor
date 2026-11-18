import { expect, it } from "vitest";
import { evaluationSeries } from "./evaluationSeries";
import { analysisGame, positionJob } from "../../testFixtures/positionAnalysis";
it("keeps engine values at matching positions and leaves missing data gaps", () => {
  const series = evaluationSeries(analysisGame, positionJob.evidence);
  expect(series.map((p) => p?.label)).toEqual([
    "+1.20",
    "-0.35",
    "+0.18",
    "+0.18",
  ]);
  expect(evaluationSeries(analysisGame, [])[1]).toBeNull();
  expect(series[0]?.advantage).toBeGreaterThan(0);
  expect(series[1]?.advantage).toBeLessThan(0);
});
