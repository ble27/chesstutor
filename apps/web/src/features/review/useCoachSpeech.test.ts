import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useCoachSpeech } from "./useCoachSpeech";
it("speaks only after opt-in and cancels old speech on navigation and unmount", () => {
  const cancel = vi.fn(),
    speak = vi.fn();
  vi.stubGlobal("speechSynthesis", {
    cancel,
    speak,
    getVoices: () => [{ localService: true, lang: "en-US" }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  const { result, rerender, unmount } = renderHook(
    ({ text, context }) => useCoachSpeech(text, context),
    { initialProps: { text: "First move", context: "1" } },
  );
  expect(speak).not.toHaveBeenCalled();
  act(() => result.current.setEnabled(true));
  expect(speak).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "First move" }),
  );
  rerender({ text: "Second move", context: "2" });
  expect(speak).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "Second move" }),
  );
  const count = cancel.mock.calls.length;
  unmount();
  expect(cancel.mock.calls.length).toBeGreaterThan(count);
});
