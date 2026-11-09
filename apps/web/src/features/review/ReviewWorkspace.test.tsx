import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { completedAnalysis } from "../../testFixtures/analysis";
import { imported } from "../../testFixtures/discovery";
import { useReplay } from "../replay/useReplay";
import { ReviewWorkspace } from "./ReviewWorkspace";
import type { Game } from "../../api/discoveryValidation";
import { analysisGame, positionJob } from "../../testFixtures/positionAnalysis";
import { PositionEvidence } from "./PositionEvidence";

function ReviewHarness({ game = imported }: { game?: Game }) {
  const replay = useReplay(game.positions.length - 1);
  return (
    <section onKeyDown={replay.onKeyDown}>
      <ReviewWorkspace
        game={game}
        selectedPly={replay.selectedPly}
        select={replay.select}
        flip={replay.flip}
      />
    </section>
  );
}

it("renders engine-supplied evaluations and keeps the analysis session through tab navigation", async () => {
  const evidence = completedAnalysis.evidence[0];
  if (!evidence) throw new Error("Missing fixture");
  const fetcher = vi.fn().mockResolvedValue(Response.json(completedAnalysis));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(
    await screen.findByText("+1.20", { selector: ".position-score strong" }),
  ).toBeVisible();
  expect(screen.getByRole("list", { name: "Engine variations" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  expect(screen.getByText(/White evaluation · after e4/)).toBeVisible();
  expect(
    screen.queryByRole("list", { name: "Engine variations" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Review" }));
  fireEvent.keyDown(screen.getByRole("tab", { name: "Review" }), {
    key: "Home",
  });
  expect(screen.getByRole("tab", { name: "Analysis" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous move" }));
  expect(screen.getByRole("list", { name: "Engine variations" })).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("synchronizes consecutive White and Black positions with engine values in both directions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(positionJob)));
  render(<ReviewHarness game={analysisGame} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(
    await screen.findByText("+1.20", { selector: ".position-score strong" }),
  ).toBeVisible();
  for (const [control, score] of [
    ["Next move", "-0.35"],
    ["Next move", "+0.18"],
    ["Next move", "+0.18"],
    ["Previous move", "+0.18"],
    ["Previous move", "-0.35"],
  ]) {
    if (!control || !score) throw new Error("Missing navigation step");
    fireEvent.click(screen.getByRole("button", { name: control }));
    expect(
      screen.getByText(score, { selector: ".position-score strong" }),
    ).toBeVisible();
  }
});

it("replaces pending evidence when a poll supplies the selected position without retaining another score", () => {
  const { rerender } = render(
    <PositionEvidence game={analysisGame} selectedPly={2} evidence={[]} />,
  );
  expect(
    screen.getByText(/evidence for this position is pending/),
  ).toBeVisible();
  rerender(
    <PositionEvidence
      game={analysisGame}
      selectedPly={2}
      evidence={positionJob.evidence}
    />,
  );
  expect(
    screen.getByText("+0.18", { selector: ".position-score strong" }),
  ).toBeVisible();
  rerender(
    <PositionEvidence game={analysisGame} selectedPly={1} evidence={[]} />,
  );
  expect(screen.queryByText("+0.18")).not.toBeInTheDocument();
});

it("retains selected-move labels and coverage and restores focus after opening a critical moment", async () => {
  const evidence = completedAnalysis.evidence[0];
  if (!evidence) throw new Error("Missing evidence");
  const payload = {
    ...completedAnalysis,
    evidence: [{ ...evidence, expected_loss: 0.25 }],
    classifications: [
      {
        ply: 1,
        mover: "white",
        classification: {
          base_label: "blunder",
          expected_loss: 0.25,
          policy_version: "v2",
        },
        badges: [],
        provisional: true,
      },
    ],
    summary: {
      players: {
        white: { counts: { blunder: 1 }, average_expected_loss: 0.25 },
        black: { counts: {}, average_expected_loss: null },
      },
      coverage: { analyzed_plies: 1, classified_plies: 1, total_plies: 1 },
      is_final: true,
      critical_moments: [
        { ply: 1, mover: "white", label: "blunder", expected_loss: 0.25 },
      ],
      practice_themes: [],
      game_conclusions: [],
    },
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
  render(<ReviewHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  await screen.findByRole("status", { name: "Analysis progress" });
  fireEvent.click(screen.getByRole("tab", { name: "Review" }));
  expect(screen.getByText("1 of 1 plies classified")).toBeVisible();
  const moment = screen.getByRole("button", {
    name: "Inspect ply 1 · blunder",
  });
  moment.focus();
  fireEvent.click(moment);
  expect(screen.getByRole("tab", { name: "Analysis" })).toHaveFocus();
  expect(
    screen.getByText(/Independent classification: blunder/),
  ).toHaveTextContent("Quick is provisional");
});

it("keeps navigation inside the tabbed workspace and preserves selection across tabs", () => {
  render(<ReviewHarness />);
  const review = screen.getByRole("region", { name: "Game review" });
  expect(
    within(review).getByRole("navigation", { name: "Replay controls" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Game moves" }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(review).getByRole("button", { name: "Next move" }));
  fireEvent.click(screen.getByRole("tab", { name: "Review" }));
  expect(screen.getByRole("button", { name: "Previous move" })).toBeEnabled();
  fireEvent.click(screen.getByRole("tab", { name: "Chess guidance" }));
  expect(screen.getByText(/Run a review to get chess guidance/)).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Analysis" }));
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
