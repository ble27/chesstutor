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

it("renders engine-supplied evaluations and keeps one analysis session while navigating moves", async () => {
  const evidence = completedAnalysis.evidence[0];
  if (!evidence) throw new Error("Missing fixture");
  const fetcher = vi.fn().mockResolvedValue(Response.json(completedAnalysis));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(
    await screen.findByText("+1.20", { selector: ".line-score" }),
  ).toBeVisible();
  expect(screen.getByRole("list", { name: "Engine variations" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  expect(screen.getByText("+1.20", { selector: ".line-score" })).toBeVisible();
  expect(
    screen.queryByRole("list", { name: "Engine variations" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  fireEvent.click(screen.getByRole("button", { name: "Previous move" }));
  expect(screen.getByRole("list", { name: "Engine variations" })).toBeVisible();
  expect(
    fetcher.mock.calls.filter((call) => !String(call[0]).includes("/lessons")),
  ).toHaveLength(1);
});

it("synchronizes consecutive White and Black positions with engine values in both directions", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(positionJob)));
  render(<ReviewHarness game={analysisGame} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(
    await screen.findByText("+1.20", { selector: ".line-score" }),
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
    expect(screen.getByText(score, { selector: ".line-score" })).toBeVisible();
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

it("puts move classifications on their selectable rows without extra jump controls", async () => {
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
          policy_version: "v3",
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
  const move = screen.getByRole("button", { name: "1. White: e4" });
  expect(move).toHaveAccessibleDescription("Blunder");
  fireEvent.click(move);
  expect(move).toHaveAttribute("aria-current", "step");
  expect(
    screen.queryByRole("button", { name: /Inspect ply/ }),
  ).not.toBeInTheDocument();
});

it("keeps navigation and the coach available alongside paired moves", () => {
  render(<ReviewHarness />);
  const review = screen.getByRole("complementary", { name: "Game insights" });
  expect(
    within(review).getByRole("navigation", { name: "Replay controls" }),
  ).toBeVisible();
  expect(
    within(review).getByRole("region", { name: "Move coach" }),
  ).toBeVisible();
  fireEvent.click(within(review).getByRole("button", { name: "Next move" }));
  expect(screen.getByRole("button", { name: "Previous move" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
});
