import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Replay } from "./Replay";
import { analysisGame, positionJob } from "../../testFixtures/positionAnalysis";

it("previews a stored line, bounds keyboard navigation, and returns to the recorded position", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(positionJob));
  vi.stubGlobal("fetch", fetcher);
  render(<Replay game={analysisGame} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  const inspect = await screen.findByRole("button", {
    name: "Explore variation 1",
  });
  fireEvent.click(inspect);
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Variation");
  fireEvent.keyDown(screen.getByRole("region", { name: "Game replay" }), {
    key: "ArrowRight",
  });
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("1 of 1");
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  fireEvent.click(screen.getByRole("button", { name: "Return to game" }));
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Starting position");
  expect(
    screen.getByRole("img", { name: "Chessboard, Black at bottom" }),
  ).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Explore variation 1" }),
    ).toHaveFocus(),
  );
  expect(
    fetcher.mock.calls.filter((call) => !String(call[0]).includes("/lessons")),
  ).toHaveLength(1);
});

it("restores the exact source candidate and exits preview when selecting a recorded move", async () => {
  const first = positionJob.evidence[0];
  if (!first) throw new Error("Missing fixture");
  const job = {
    ...positionJob,
    evidence: [
      { ...first, best: [...first.best, ...first.best] },
      ...positionJob.evidence.slice(1),
    ],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(job)));
  render(<Replay game={analysisGame} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Explore variation 2" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Return to game" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Explore variation 2" }),
    ).toHaveFocus(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Explore variation 2" }));
  fireEvent.click(screen.getByRole("button", { name: "1... Black: e5" }));
  expect(
    screen.queryByRole("button", { name: "Return to game" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("After 1... Black: e5");
});
