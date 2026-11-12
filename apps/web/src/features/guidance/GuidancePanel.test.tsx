import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { completedAnalysis } from "../../testFixtures/analysis";
import { answer, lessons, refusal } from "../../testFixtures/coaching";
import { GuidancePanel } from "./GuidancePanel";

afterEach(() => vi.unstubAllGlobals());

function route(
  handlers: { coach?: () => Response; lessons?: () => Response } = {},
) {
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    (url) =>
      Promise.resolve(
        url.includes("/coach")
          ? (handlers.coach?.() ?? Response.json(answer))
          : (handlers.lessons?.() ?? Response.json(lessons)),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function setup(
  selectedPly = 1,
  analysis: typeof completedAnalysis | null = completedAnalysis,
) {
  const onArrows = vi.fn();
  render(
    <GuidancePanel
      analysis={analysis}
      selectedPly={selectedPly}
      onArrows={onArrows}
    />,
  );
  return onArrows;
}

it("asks for a review first when there is no analysis", () => {
  route();
  setup(1, null);
  expect(screen.getByText(/Run a review to get chess guidance/)).toBeVisible();
});

it("explains a flagged move in plain words with a text equivalent of the arrows", async () => {
  route();
  setup();
  expect(
    await screen.findByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  expect(screen.getByText("Mistake")).toBeVisible();
  const arrows = screen.getByRole("list", { name: "Board arrows" });
  expect(arrows).toHaveTextContent("Your move: g1 to h1");
  expect(arrows).toHaveTextContent("Suggestion 1: d1 to d4");
});

it("draws the played and suggested arrows and removes them on request", async () => {
  route();
  const onArrows = setup();
  await screen.findByText(/leaves your rook/);
  await waitFor(() =>
    expect(onArrows).toHaveBeenLastCalledWith([
      expect.objectContaining({ startSquare: "g1", endSquare: "h1" }),
      expect.objectContaining({ startSquare: "d1", endSquare: "d4" }),
    ]),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Show arrows on the board" }),
  );
  expect(onArrows).toHaveBeenLastCalledWith([]);
});

it("does not annotate a move without a lesson and clears arrows", async () => {
  route({ lessons: () => Response.json({ ...lessons, lessons: [] }) });
  const onArrows = setup();
  expect(await screen.findByText(/This move was not flagged/)).toBeVisible();
  expect(onArrows).toHaveBeenLastCalledWith([]);
});

it("explains that the starting position has no move to discuss", async () => {
  route();
  setup(0);
  expect(
    await screen.findByText(/Select a move to see its note/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Explain this move" }),
  ).toBeDisabled();
});

it("reloads notes at the intermediate level", async () => {
  const fetcher = route();
  setup();
  await screen.findByText(/leaves your rook/);
  fireEvent.click(screen.getByRole("radio", { name: "Intermediate" }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes("level=intermediate"),
      ),
    ).toBe(true),
  );
});

it("answers a suggested question from the selected move", async () => {
  const fetcher = route();
  setup();
  await screen.findByText(/leaves your rook/);
  fireEvent.click(screen.getByRole("button", { name: "Explain this move" }));
  expect(
    await screen.findByText(/can capture the opponent's queen/),
  ).toBeVisible();
  const call = fetcher.mock.calls.find(([url]) =>
    String(url).includes("/coach"),
  );
  const init = call?.[1] as RequestInit | undefined;
  expect(JSON.parse(String(init?.body))).toEqual({
    ply: 1,
    player_color: "white",
    level: "beginner",
    intent: "explain_move",
  });
});

it("sends a typed question, bounds it, and shows a refusal verbatim", async () => {
  const fetcher = route({ coach: () => Response.json(refusal) });
  setup();
  await screen.findByText(/leaves your rook/);
  const box = screen.getByRole("textbox", { name: "Ask a chess question" });
  expect(box).toHaveAttribute("maxlength", "1000");
  fireEvent.change(box, { target: { value: "Write a soup recipe." } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(
    await screen.findByText(/Choose a chess question about this game/),
  ).toBeVisible();
  const call = fetcher.mock.calls.find(([url]) =>
    String(url).includes("/coach"),
  );
  const init = call?.[1] as RequestInit | undefined;
  expect(JSON.parse(String(init?.body)).question).toBe("Write a soup recipe.");
});

it("keeps the notes visible when the coach is unavailable and allows a retry", async () => {
  let fail = true;
  route({
    coach: () =>
      fail
        ? Response.json(
            {
              code: "dependencies_unavailable",
              message: "Coach is busy",
              retryable: true,
              request_id: "r",
            },
            { status: 503 },
          )
        : Response.json(answer),
  });
  setup();
  await screen.findByText(/leaves your rook/);
  fireEvent.click(screen.getByRole("button", { name: "Explain this move" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Coach is busy");
  expect(screen.getByText(/leaves your rook/)).toBeVisible();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByText(/can capture the opponent's queen/),
  ).toBeVisible();
});

it("reports unavailable notes without hiding the question controls", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  setup();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /could not be reached/,
  );
  expect(
    screen.getByRole("button", { name: "Explain this move" }),
  ).toBeEnabled();
});

it("labels notes from an unfinished analysis as incomplete", async () => {
  route({ lessons: () => Response.json({ ...lessons, complete: false }) });
  setup();
  expect(await screen.findByText(/analysis is still running/i)).toBeVisible();
});

it("shows the matching suggested move's engine score with its perspective", async () => {
  const lesson = lessons.lessons[0];
  if (!lesson) throw new Error("Missing lesson");
  route({
    lessons: () =>
      Response.json({
        ...lessons,
        lessons: [
          {
            ...lesson,
            arrows: [
              {
                kind: "suggested",
                rank: 1,
                from_square: "e2",
                to_square: "e4",
                uci: "e2e4",
              },
            ],
          },
        ],
      }),
  });
  setup();
  const arrows = await screen.findByRole("list", { name: "Board arrows" });
  expect(arrows).toHaveTextContent(
    "Suggestion 1: e2 to e4 · White evaluation: +1.2",
  );
});
