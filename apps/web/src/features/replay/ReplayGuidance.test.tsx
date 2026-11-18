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
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  await screen.findByText(
    (_, node) =>
      node?.matches(".coach-note") === true &&
      (node.textContent ?? "").includes("leaves your rook"),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Before 1. White: e4 · White to move");
  fireEvent.click(screen.getByRole("checkbox", { name: "Board arrows" }));
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.positions[1]?.fen ?? "missing",
  );
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("After 1. White: e4");
});

it("starts self-analysis at the selected recorded position without changing recorded selection", async () => {
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
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  await screen.findByText(
    (_, node) =>
      node?.matches(".coach-note") === true &&
      node.textContent === "Your pawn moved from e2 to e4.",
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  expect(
    screen.getByRole("img", { name: "Evaluation +1.20, White perspective" }),
  ).toBeVisible();
  fireEvent.change(screen.getByRole("slider", { name: "Position on graph" }), {
    target: { value: "1" },
  });
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.positions[1]?.fen ?? "missing",
  );
  expect(
    screen.getByRole("checkbox", { name: "Board arrows" }),
  ).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Board arrows" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      imported.initial_fen,
    ),
  );
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Self-analysis" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/sandbox"))).toBe(
      true,
    ),
  );
  const call = fetcher.mock.calls.find(([url]) => url.endsWith("/sandbox"));
  expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
    root_ply: 1,
    branch: [],
  });
  await screen.findByText("0/100 plies");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Report" }));
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
