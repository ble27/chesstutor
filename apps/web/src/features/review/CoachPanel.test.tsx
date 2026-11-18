import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CoachPanel } from "./CoachPanel";
import { guidanceAnalysis, lessons } from "../../testFixtures/coaching";
it("automatically explains the ply without exposing standalone chat", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(lessons));
  vi.stubGlobal("fetch", fetcher);
  render(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      selectedSan="e4"
      onArrows={vi.fn()}
    />,
  );
  expect(
    await screen.findByText(
      (_, node) =>
        node?.matches(".coach-note") === true &&
        (node.textContent ?? "").includes("leaves your rook"),
    ),
  ).toBeVisible();
  expect(screen.getByText("e4", { selector: ".coach-move" })).toBeVisible();
  expect(
    document.querySelector(".coach-response .coach-note strong"),
  ).toBeVisible();
  expect(
    screen.queryByRole("textbox", { name: /question/i }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mute coach" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    fetcher.mock.calls.every(([url]) => String(url).includes("/lessons")),
  ).toBe(true);
});

it("suspends arrows during previews and preserves the user's arrow choice on return", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(lessons)));
  const onArrows = vi.fn();
  const { rerender } = render(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      onArrows={onArrows}
    />,
  );
  await screen.findByText(
    (_, node) =>
      node?.matches(".coach-note") === true &&
      (node.textContent ?? "").includes("leaves your rook"),
  );
  rerender(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      onArrows={onArrows}
      suspended
    />,
  );
  expect(onArrows).toHaveBeenLastCalledWith([]);
  rerender(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      onArrows={onArrows}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Board arrows" }));
  rerender(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      onArrows={onArrows}
      suspended
    />,
  );
  rerender(
    <CoachPanel
      analysis={guidanceAnalysis}
      selectedPly={1}
      onArrows={onArrows}
    />,
  );
  expect(
    screen.getByRole("checkbox", { name: "Board arrows" }),
  ).not.toBeChecked();
  expect(onArrows).toHaveBeenLastCalledWith([]);
});
