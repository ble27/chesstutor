import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { askCoach } from "../../api/coaching";
import { completedAnalysis } from "../../testFixtures/analysis";
import { answer } from "../../testFixtures/coaching";
import { useCoach } from "./useGuidance";

vi.mock("../../api/coaching", () => ({ askCoach: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const question = {
  ply: 1,
  player_color: "white",
  level: "beginner",
  intent: "explain_move",
} as const;

function pendingAnswer() {
  let resolve: ((value: typeof answer) => void) | undefined;
  const promise = new Promise<typeof answer>((done) => {
    resolve = done;
  });
  vi.mocked(askCoach).mockReturnValueOnce(promise);
  return {
    promise,
    resolve: (value: typeof answer) => {
      if (!resolve) throw new Error("Promise not initialized");
      resolve(value);
    },
  };
}

it("aborts and ignores an answer after the selected context is reset", async () => {
  const pending = pendingAnswer();
  const { result } = renderHook(() => useCoach(completedAnalysis));
  act(() => result.current.ask(question));
  act(() => result.current.reset());
  expect(vi.mocked(askCoach).mock.calls[0]?.[2].aborted).toBe(true);
  await act(async () => {
    pending.resolve(answer);
    await pending.promise;
  });
  expect(result.current.state.status).toBe("idle");
});

it("clears answers and ignores pending work when the analysis changes", async () => {
  const pending = pendingAnswer();
  const { result, rerender } = renderHook(
    ({ analysis }) => useCoach(analysis),
    { initialProps: { analysis: completedAnalysis } },
  );
  act(() => result.current.ask(question));
  rerender({ analysis: { ...completedAnalysis, id: "other-analysis" } });
  await act(async () => {
    pending.resolve(answer);
    await pending.promise;
  });
  expect(result.current.state.status).toBe("idle");
});

it("ignores a superseded answer even if its transport resolves after abort", async () => {
  const first = pendingAnswer();
  const second = pendingAnswer();
  const { result } = renderHook(() => useCoach(completedAnalysis));
  act(() => result.current.ask(question));
  act(() => result.current.ask({ ...question, intent: "better_move" }));
  await act(async () => {
    second.resolve(answer);
    await second.promise;
  });
  await act(async () => {
    first.resolve({ ...answer, text: "Old answer" });
    await first.promise;
  });
  expect(result.current.state).toEqual({ status: "answered", answer });
});
