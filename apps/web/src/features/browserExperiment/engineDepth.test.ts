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
    (lines) => updates.push(lines.length),
  );
  expect(FakeWorker.commands).toContain("go depth 40 movetime 9500");
  expect(result.map((line) => line.pv[0])).toEqual(["e2e4", "d2d4"]);
  expect(updates).toEqual([2]);
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

it("requests two ranked lines for live analysis", async () => {
  const signal = new AbortController().signal;
  const engine = new BrowserEngine("single-a496a04", signal);
  await engine.ready(1, signal);
  await engine.searchPosition(
    imported.initial_fen,
    [],
    18,
    signal,
    () => undefined,
  );
  expect(FakeWorker.commands).toContain("setoption name MultiPV value 2");
  engine.close();
});

it("stops a superseded position without terminating the engine", async () => {
  const session = new AbortController();
  const position = new AbortController();
  const engine = new BrowserEngine("single-a496a04", session.signal);
  await engine.ready(1, session.signal);
  FakeWorker.held = true;
  const search = engine.searchPosition(
    imported.initial_fen,
    [],
    18,
    session.signal,
    () => undefined,
    position.signal,
  );
  position.abort();
  expect(FakeWorker.commands.at(-1)).toBe("stop");
  const worker = [...FakeWorker.active][0];
  worker?.onmessage?.(new MessageEvent("message", { data: "bestmove e2e4" }));
  await expect(search).resolves.toEqual([]);
  expect(FakeWorker.active.size).toBe(1);
  FakeWorker.held = false;
  await expect(
    engine.searchPosition(
      imported.initial_fen,
      ["e2e4"],
      18,
      session.signal,
      () => undefined,
    ),
  ).resolves.toHaveLength(2);
  session.abort();
  expect(FakeWorker.active.size).toBe(0);
});
