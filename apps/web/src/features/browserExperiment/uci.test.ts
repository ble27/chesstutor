import { expect, it } from "vitest";
import { parseInfo } from "./uci";

it("preserves signed mate distance and raw WDL without centipawn conversion", () => {
  const line = parseInfo(
    "info depth 14 score mate -3 wdl 0 0 1000 nodes 30000 time 90 pv e2e4 e7e5",
  );
  expect(line?.score).toEqual({ kind: "mate", value: -3 });
  expect(line?.wdl).toEqual([0, 0, 1000]);
  expect(line?.pv).toEqual(["e2e4", "e7e5"]);
});

it("retains score bounds and missing WDL as uncertain evidence", () => {
  const line = parseInfo(
    "info depth 8 score cp 25 lowerbound nodes 1000 time 10 pv g1f3",
  );
  expect(line?.bounded).toBe(true);
  expect(line?.wdl).toBeNull();
});

it.each([
  "info depth 12 score cp 20 wdl 500 500 500 nodes 10 time 1 pv e2e4",
  "info depth 12 score cp 20 nodes 10 time 1 pv a9b2",
  "info depth 12 score cp 20 nodes 10 time 1",
  "info depth 0 score cp 20 nodes 10 time 1 pv e2e4",
  "bestmove e2e4",
])("rejects incomplete or malformed UCI evidence: %s", (message) => {
  expect(parseInfo(message)).toBeNull();
});
