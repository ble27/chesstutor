import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  expansionGame,
  expansionJob,
} from "../../testFixtures/reviewExpansion";
import { MoveList } from "./MoveList";

it("labels analyzed plies and keeps unclassified distinct from pending", () => {
  const reviews = expansionJob.classifications;
  render(
    <MoveList
      game={expansionGame}
      selectedPly={1}
      select={vi.fn()}
      reviews={reviews}
    />,
  );
  expect(
    screen.getByRole("button", { name: "1. White: e4" }),
  ).toHaveTextContent("Best move");
  expect(
    screen.getByRole("button", { name: "1. White: e4" }),
  ).toHaveAccessibleDescription("Best move");
  expect(
    screen.getByRole("button", { name: "1... Black: e5" }),
  ).toHaveTextContent("Best move");
  expect(
    screen.getByRole("button", { name: "2. White: Nf3" }),
  ).toHaveTextContent("Review needed");
});

it("shows pending for unprocessed plies without borrowing another ply's label", () => {
  render(
    <MoveList
      game={expansionGame}
      selectedPly={1}
      select={vi.fn()}
      reviews={expansionJob.classifications?.slice(0, 1)}
    />,
  );
  expect(
    screen.getByRole("button", { name: "1. White: e4" }),
  ).toHaveTextContent("Best move");
  expect(
    screen.getByRole("button", { name: "1... Black: e5" }),
  ).toHaveTextContent("Awaiting analysis");
  expect(
    screen.getByRole("button", { name: "1... Black: e5" }),
  ).toHaveAccessibleDescription("Awaiting analysis");
  expect(
    screen.getByRole("button", { name: "2. White: Nf3" }),
  ).toHaveTextContent("Awaiting analysis");
});
