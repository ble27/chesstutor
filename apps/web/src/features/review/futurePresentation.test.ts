/** PRD §§4,6,8; plan.md S6; AGENTS.md deterministic public-boundary tests. */
import { expect, it } from "vitest";

type Score =
  | { kind: "cp"; centipawns: number; pov: "white" | "black" }
  | { kind: "mate"; moves: number; pov: "white" | "black" };
type State =
  | "queued"
  | "running"
  | "cancel_requested"
  | "cancelled"
  | "failed"
  | "completed";
type Evidence = { gameId: string; ply: number; score: Score };
interface Presentation {
  formatWhiteEvaluation(score: Score): string;
  reviewPresentation(input: {
    gameId: string;
    selectedPly: number;
    evidence: Evidence | null;
    state: State;
    completedPlies: number;
    totalPlies: number;
    mode: "quick" | "deep";
    retryAfterSeconds?: number;
  }): {
    evaluation: string | null;
    evidenceStatus: "pending" | "available";
    coverageText: string;
    isFinal: boolean;
    canRetry: boolean;
    statusText: string;
    provisional: boolean;
    retryAfterSeconds: number | null;
  };
}

async function presentation(): Promise<Presentation> {
  // Proposed S6 seam. Dynamic loading permits collection/type-checking before
  // implementation; missing code remains a real test failure, never a skip.
  const path = "./reviewPresentation.ts";
  const module: unknown = await import(/* @vite-ignore */ path);
  if (
    typeof module !== "object" ||
    module === null ||
    !("formatWhiteEvaluation" in module) ||
    typeof module.formatWhiteEvaluation !== "function" ||
    !("reviewPresentation" in module) ||
    typeof module.reviewPresentation !== "function"
  )
    throw new Error("S6 reviewPresentation public interface is missing");
  return module as Presentation;
}

it.each([
  [{ kind: "cp", centipawns: 120, pov: "white" }, "+1.2"],
  [{ kind: "cp", centipawns: -120, pov: "white" }, "-1.2"],
  [{ kind: "cp", centipawns: 120, pov: "black" }, "-1.2"],
  [{ kind: "cp", centipawns: -120, pov: "black" }, "+1.2"],
  [{ kind: "cp", centipawns: 0, pov: "black" }, "0.0"],
  [{ kind: "mate", moves: 3, pov: "white" }, "M3"],
  [{ kind: "mate", moves: -3, pov: "white" }, "-M3"],
  [{ kind: "mate", moves: 3, pov: "black" }, "-M3"],
  [{ kind: "mate", moves: -3, pov: "black" }, "M3"],
] satisfies [Score, string][])(
  "formats %j as White-perspective %s without converting mate to pawns",
  async (score, expected) => {
    expect((await presentation()).formatWhiteEvaluation(score)).toBe(expected);
  },
);

const evidence: Evidence = {
  gameId: "game-a",
  ply: 2,
  score: { kind: "cp", centipawns: 120, pov: "white" },
};
const complete = {
  gameId: "game-a",
  selectedPly: 2,
  evidence,
  state: "completed",
  completedPlies: 4,
  totalPlies: 4,
  mode: "deep",
} as const;

it.each([{ ...evidence, ply: 1 }, { ...evidence, gameId: "game-b" }, null])(
  "keeps wrong-ply, wrong-game, or absent evidence pending: %j",
  async (item) => {
    const result = (await presentation()).reviewPresentation({
      ...complete,
      evidence: item,
    });
    expect(result.evaluation).toBeNull();
    expect(result.evidenceStatus).toBe("pending");
  },
);

it("renders evidence for the selected ply", async () => {
  const result = (await presentation()).reviewPresentation(complete);
  expect(result.evaluation).toBe("+1.2");
  expect(result.evidenceStatus).toBe("available");
  expect(result.isFinal).toBe(true);
});

it.each([
  "queued",
  "running",
  "cancel_requested",
  "cancelled",
  "failed",
] satisfies State[])("%s remains explicitly incomplete", async (state) => {
  const result = (await presentation()).reviewPresentation({
    ...complete,
    state,
    completedPlies: 2,
  });
  expect(result.isFinal).toBe(false);
  expect(result.coverageText).toContain("2/4");
  expect(result.statusText.toLowerCase()).not.toMatch(/analysis complete/);
  expect(result.canRetry).toBe(state === "cancelled" || state === "failed");
});

it("does not display a terminal state with missing evidence as final", async () => {
  const result = (await presentation()).reviewPresentation({
    ...complete,
    completedPlies: 2,
  });
  expect(result.isFinal).toBe(false);
});

it("marks Quick provisional relative to Deep", async () => {
  const api = await presentation();
  expect(
    api.reviewPresentation({ ...complete, mode: "quick" }).provisional,
  ).toBe(true);
  expect(api.reviewPresentation(complete).provisional).toBe(false);
});

it("preserves the server quota retry time", async () => {
  const result = (await presentation()).reviewPresentation({
    ...complete,
    state: "failed",
    retryAfterSeconds: 120,
  });
  expect(result.retryAfterSeconds).toBe(120);
});
