import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useSandbox } from "./useSandbox";
import { imported } from "../../testFixtures/discovery";
import type { SandboxPosition } from "../../api/sandbox";
import { sandboxPosition } from "../../api/sandbox";
vi.mock("../../api/sandbox", () => ({ sandboxPosition: vi.fn() }));
const position: SandboxPosition = {
  trust: "client_unverified",
  fen: imported.initial_fen,
  initial_fen: imported.initial_fen,
  moves: [],
  positions: [],
  legal_moves: ["e2e4", "d2d4"],
  result: null,
  claimable_draw: false,
  line: null,
  lines: [],
};
it("keeps recorded replay separate and saves a branch when replacing a redo move", async () => {
  vi.mocked(sandboxPosition).mockImplementation(async () => ({
    ...position,
    moves: [],
    positions: [],
    legal_moves: [...position.legal_moves],
  }));
  const { result } = renderHook(() => useSandbox(imported));
  act(() => result.current.begin(0));
  await waitFor(() => expect(result.current.busy).toBe(false));
  act(() => result.current.play("e2e4"));
  await waitFor(() => expect(result.current.branch).toEqual(["e2e4"]));
  act(() => result.current.undo());
  await waitFor(() => expect(result.current.future).toEqual(["e2e4"]));
  act(() => result.current.play("d2d4"));
  await waitFor(() => expect(result.current.saved).toEqual([["e2e4"]]));
  act(() => result.current.exit());
  expect(result.current.enabled).toBe(false);
  expect(imported.positions).toHaveLength(2);
});
it("retains the previous legal board after a backend failure", async () => {
  vi.mocked(sandboxPosition)
    .mockResolvedValueOnce({
      ...position,
      moves: [],
      positions: [],
      legal_moves: [...position.legal_moves],
    })
    .mockRejectedValueOnce(new Error("Backend unavailable"));
  const { result } = renderHook(() => useSandbox(imported));
  act(() => result.current.begin(0));
  await waitFor(() => expect(result.current.position).not.toBeNull());
  act(() => result.current.play("e2e4"));
  await waitFor(() => expect(result.current.error).toBe("Backend unavailable"));
  expect(result.current.branch).toEqual([]);
  expect(result.current.position?.fen).toBe(imported.initial_fen);
});

it("ignores a late legal-position response after returning to the recorded game", async () => {
  let complete:
    ((value: Awaited<ReturnType<typeof sandboxPosition>>) => void) | undefined;
  vi.mocked(sandboxPosition).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { result } = renderHook(() => useSandbox(imported));
  act(() => result.current.begin(0));
  act(() => result.current.exit());
  const resolve = complete;
  if (!resolve) throw new Error("Missing request");
  await act(async () =>
    resolve({
      ...position,
      moves: [],
      positions: [],
      legal_moves: [...position.legal_moves],
    }),
  );
  expect(result.current.enabled).toBe(false);
  expect(result.current.position).toBeNull();
});
