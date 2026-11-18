import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CoachVoice } from "./CoachVoice";

afterEach(() => vi.unstubAllGlobals());

it("uses device speech when the API has no voice configured", async () => {
  const speak = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
  );
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [],
    speak,
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  });
  render(
    <CoachVoice
      analysisId="game"
      ply={1}
      text="Knight to f3."
      muted={false}
      onMute={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Play coach voice" }));
  await waitFor(() =>
    expect(speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Knight to f3." }),
    ),
  );
});
