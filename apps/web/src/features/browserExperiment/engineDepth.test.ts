import { beforeEach, expect, it } from "vitest";
import { BrowserEngine } from "./engine";
import { fakePorts, FakeWorker } from "./testPorts";
import { imported } from "../../testFixtures/discovery";
beforeEach(() => {
  fakePorts();
});
it("bounds requested depth and sends a fixed local time budget", async () => {
  const current = new AbortController();
  const engine = new BrowserEngine("single-a496a04", current.signal);
  await engine.ready(1, current.signal);
  const updates: number[] = [];
  const result = await engine.searchPosition(
    imported.initial_fen,
    [],
    40,
    current.signal,
    (line) => updates.push(line.depth),
  );
  expect(FakeWorker.commands).toContain("go depth 40 movetime 9500");
  expect(result.depth).toBe(12);
  expect(updates).toEqual([12]);
  await expect(
    engine.searchPosition(
      imported.initial_fen,
      [],
      41,
      current.signal,
      () => undefined,
    ),
  ).rejects.toThrow("depth");
  engine.close();
});
it("cancellation terminates a held local search worker", async () => {
  const current = new AbortController();
  const engine = new BrowserEngine("single-a496a04", current.signal);
  await engine.ready(1, current.signal);
  FakeWorker.held = true;
  const result = engine.searchPosition(
    imported.initial_fen,
    ["e2e4"],
    18,
    current.signal,
    () => undefined,
  );
  current.abort();
  await expect(result).rejects.toThrow(/cancelled/);
  expect(FakeWorker.active.size).toBe(0);
});
