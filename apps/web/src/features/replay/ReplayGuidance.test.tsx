import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { completedAnalysis } from "../../testFixtures/analysis";
import { lessons } from "../../testFixtures/coaching";
import { imported } from "../../testFixtures/discovery";
import { Replay } from "./Replay";

afterEach(() => vi.unstubAllGlobals());

it("previews the pre-move board for guidance arrows and restores replay when hidden", async () => {
  const lesson = lessons.lessons[0];
  if (!lesson) throw new Error("Missing lesson");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes("/lessons")
            ? {
                ...lessons,
                lessons: [
                  {
                    ...lesson,
                    arrows: [
                      {
                        kind: "played",
                        rank: 0,
                        from_square: "e2",
                        to_square: "e4",
                        uci: "e2e4",
                      },
                    ],
                  },
                ],
              }
            : completedAnalysis,
        ),
      ),
    ),
  );
  render(<Replay game={imported} />);
  fireEvent.click(screen.getByRole("button", { name: "1. White: e4" }));
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  await screen.findByText(/Completed · 1\/1 plies/);
  fireEvent.click(screen.getByRole("tab", { name: "Chess guidance" }));
  await screen.findByText(/leaves your rook/);
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Before 1. White: e4 · White to move");
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show arrows on the board" }),
  );
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.positions[1]?.fen ?? "missing",
  );
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("After 1. White: e4");
});
