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
  await screen.findByText(/leaves your rook/);
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Before 1. White: e4 · White to move");
  fireEvent.click(screen.getByText("Coach options and alternatives"));
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

it("starts free analysis at the displayed pre-move preview without changing recorded selection", async () => {
  const lesson = lessons.lessons[0];
  if (!lesson) throw new Error("Missing fixture");
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    (url) =>
      Promise.resolve(
        Response.json(
          url.includes("/lessons")
            ? {
                ...lessons,
                lessons: [
                  {
                    ...lesson,
                    kind: "best",
                    text: "Your pawn moved from e2 to e4.",
                    alternatives: [],
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
            : url.endsWith("/sandbox")
              ? {
                  trust: "client_unverified",
                  fen: imported.initial_fen,
                  initial_fen: imported.initial_fen,
                  moves: [],
                  positions: [],
                  legal_moves: ["e2e4"],
                  result: null,
                  claimable_draw: false,
                  line: null,
                }
              : completedAnalysis,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<Replay game={imported} />);
  fireEvent.click(screen.getByRole("button", { name: "1. White: e4" }));
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  await screen.findByText("Your pawn moved from e2 to e4.");
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  expect(screen.getByText("White evaluation · current position")).toBeVisible();
  fireEvent.change(screen.getByRole("slider", { name: "Position on graph" }), {
    target: { value: "1" },
  });
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.positions[1]?.fen ?? "missing",
  );
  fireEvent.click(screen.getByText("Coach options and alternatives"));
  expect(
    screen.getByRole("checkbox", { name: "Show arrows on the board" }),
  ).not.toBeChecked();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show arrows on the board" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Self-analysis / Free play" }),
  );
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/sandbox"))).toBe(
      true,
    ),
  );
  const call = fetcher.mock.calls.find(([url]) => url.endsWith("/sandbox"));
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    root_ply: 0,
    branch: [],
  });
  await screen.findByText(/branch 0\/100 plies/);
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
