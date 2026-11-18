/** PRD §4 variation return; plan.md S6. No browser-side chess rules. */
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";

const e4Fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
const e5Fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const nf3Fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
type Position = { fen: string; san: string; uci: string };
interface Variation {
  kind: "game" | "variation";
  selectedPly: number;
  orientation: "white" | "black";
  fen: string;
  enter(input: {
    rootPly: number;
    rootFen: string;
    positions: Position[];
  }): void;
  next(): void;
  previous(): void;
  exit(): void;
  flip(): void;
}
interface VariationModule {
  useVariation(input: {
    selectedPly: number;
    fen: string;
    orientation: "white" | "black";
  }): Variation;
}
async function variationModule(): Promise<VariationModule> {
  const path = "./useVariation.ts";
  const module: unknown = await import(/* @vite-ignore */ path);
  if (
    typeof module !== "object" ||
    module === null ||
    !("useVariation" in module) ||
    typeof module.useVariation !== "function"
  )
    throw new Error("S6 useVariation public interface is missing");
  return module as VariationModule;
}
const line = {
  rootPly: 1,
  rootFen: e4Fen,
  positions: [
    { fen: e5Fen, san: "e5", uci: "e7e5" },
    { fen: nf3Fen, san: "Nf3", uci: "g1f3" },
  ],
};

it("returning from a variation restores the original selection and FEN", async () => {
  const { useVariation } = await variationModule();
  const { result } = renderHook(() =>
    useVariation({ selectedPly: 1, fen: e4Fen, orientation: "black" }),
  );
  act(() => result.current.enter(line));
  expect(result.current.kind).toBe("variation");
  act(() => result.current.next());
  expect(result.current.fen).toBe(e5Fen);
  act(() => result.current.next());
  expect(result.current.fen).toBe(nf3Fen);
  act(() => result.current.exit());
  expect(result.current.kind).toBe("game");
  expect(result.current.selectedPly).toBe(1);
  expect(result.current.fen).toBe(e4Fen);
  expect(result.current.orientation).toBe("black");
});

it("variation navigation bounds its endpoints and flipping preserves the game selection", async () => {
  const { useVariation } = await variationModule();
  const { result } = renderHook(() =>
    useVariation({ selectedPly: 1, fen: e4Fen, orientation: "white" }),
  );
  act(() => result.current.enter(line));
  act(() => result.current.previous());
  expect(result.current.fen).toBe(e4Fen);
  act(() => result.current.next());
  act(() => result.current.next());
  act(() => result.current.next());
  expect(result.current.fen).toBe(nf3Fen);
  act(() => result.current.flip());
  act(() => result.current.exit());
  expect(result.current.selectedPly).toBe(1);
  expect(result.current.fen).toBe(e4Fen);
  expect(result.current.orientation).toBe("black");
});

it("drops a variation when its recorded game context changes", async () => {
  const { useVariation } = await variationModule();
  const { result, rerender } = renderHook((input) => useVariation(input), {
    initialProps: { selectedPly: 1, fen: e4Fen, orientation: "white" as const },
  });
  act(() => result.current.enter(line));
  act(() => result.current.next());
  rerender({ selectedPly: 2, fen: e5Fen, orientation: "white" });
  expect(result.current.kind).toBe("game");
  expect(result.current.fen).toBe(e5Fen);
});
