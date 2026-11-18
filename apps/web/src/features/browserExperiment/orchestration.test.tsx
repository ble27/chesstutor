import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { IDBOpenDBRequest } from "fake-indexeddb";
import { imported } from "../../testFixtures/discovery";
import { BrowserExperiment } from "./BrowserExperiment";
import { fakePorts, FakeWorker, twoPlyGame } from "./testPorts";

// Asset loading is the network/download boundary; actual hashes/builds are
// exercised by real WASM browser tests, not by this deterministic orchestration suite.
vi.mock("../../api/browserEngineAssets", () => ({
  prepareEngine: async () => {},
  engineScript: () => "fixture-worker.js",
}));
let ports: ReturnType<typeof fakePorts>;
beforeEach(() => {
  ports = fakePorts();
});
const finished = () => screen.findByText(/Screening finished/);

it("reviews selected root first and reuses its best line when it is the played move", async () => {
  render(<BrowserExperiment game={twoPlyGame} selectedPly={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Browser Quick review" }));
  await finished();
  expect(FakeWorker.roots[0]).toContain(" moves e2e4");
  expect(
    FakeWorker.commands.filter((command) => command.startsWith("go ")),
  ).toHaveLength(2);
  expect(
    FakeWorker.commands.some((command) => command.includes("searchmoves")),
  ).toBe(false);
  expect(screen.getByText("2/2 plies available")).toBeVisible();
  expect(FakeWorker.active.size).toBe(0);
});

it("revalidates cached positions without starting a new worker and refines only the selected root", async () => {
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  const quick = screen.getByRole("button", { name: "Browser Quick review" });
  fireEvent.click(quick);
  await finished();
  const searches = FakeWorker.roots.length,
    requests = ports.fetcher.mock.calls.length;
  fireEvent.click(quick);
  await finished();
  expect(FakeWorker.roots).toHaveLength(searches);
  expect(ports.fetcher.mock.calls.length).toBe(requests + 1);
  fireEvent.click(screen.getByRole("button", { name: "Deepen selected move" }));
  await screen.findByText(/Selected move refinement finished/);
  expect(FakeWorker.roots).toHaveLength(searches + 1);
  expect(FakeWorker.commands).toContain("go nodes 300000 movetime 1500");
});

it("rejects bad cached evidence, clears that cache and can recompute on retry", async () => {
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  const quick = screen.getByRole("button", { name: "Browser Quick review" });
  fireEvent.click(quick);
  await finished();
  ports.fetcher.mockResolvedValueOnce(
    Response.json(
      {
        code: "invalid_evidence",
        message: "Invalid cached PV",
        retryable: false,
        request_id: "fixture",
      },
      { status: 422 },
    ),
  );
  fireEvent.click(quick);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid cached PV",
  );
  const searches = FakeWorker.roots.length;
  fireEvent.click(quick);
  await finished();
  expect(FakeWorker.roots).toHaveLength(searches + 1);
});

it("cancels a running search and reaps its worker", async () => {
  FakeWorker.held = true;
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Browser Quick review" }));
  await waitFor(() => expect(FakeWorker.roots).toHaveLength(1));
  fireEvent.click(
    screen.getByRole("button", { name: "Cancel browser analysis" }),
  );
  expect(FakeWorker.active.size).toBe(0);
  expect(
    screen.getByRole("status", { name: "Browser analysis progress" }),
  ).toHaveTextContent("Cancelled");
});

it("reaps its worker immediately even if local storage is blocked after search", async () => {
  const open = ports.factory.open.bind(ports.factory);
  let calls = 0;
  vi.spyOn(ports.factory, "open").mockImplementation((...args) => {
    calls++;
    return calls === 1 ? open(...args) : new IDBOpenDBRequest();
  });
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Browser Quick review" }));
  await waitFor(() => expect(calls).toBe(2));
  fireEvent.click(
    screen.getByRole("button", { name: "Cancel browser analysis" }),
  );
  expect(FakeWorker.active.size).toBe(0);
});

it("searches a differing played move at the identical pre-move root", async () => {
  FakeWorker.alternative = true;
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Browser Quick review" }));
  await finished();
  expect(FakeWorker.roots).toHaveLength(2);
  expect(FakeWorker.roots[0]).toBe(FakeWorker.roots[1]);
  expect(FakeWorker.commands).toContain(
    "go nodes 30000 movetime 250 searchmoves e2e4",
  );
});

it("can refine one selected move without claiming whole-game coverage", async () => {
  render(<BrowserExperiment game={twoPlyGame} selectedPly={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Deepen selected move" }));
  await screen.findByText(/Selected move refinement finished/);
  expect(FakeWorker.roots).toHaveLength(1);
  expect(FakeWorker.roots[0]).toContain(" moves e2e4");
  expect(screen.getByText("1/2 plies available")).toBeVisible();
});
