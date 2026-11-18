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
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("Black at bottom");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Explore variation 1" }),
    ).toHaveFocus(),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
