import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Board } from "./Board";
import { ReplayControls } from "./ReplayControls";
import { imported } from "../../testFixtures/discovery";

it("uses explicit classic assets for all visible pieces", () => {
  render(
    <Board
      fen={imported.initial_fen}
      orientation="white"
      lastMove={null}
      describedBy="position"
    />,
  );
  const board = screen.getByRole("img", { name: /Chessboard/ });
  expect(board.querySelectorAll('img[src^="/pieces/classic/"]')).toHaveLength(
    32,
  );
});
it("keeps navigation names while presenting SVG icons", () => {
  render(
    <ReplayControls
      selectedPly={0}
      lastPly={3}
      select={vi.fn()}
      flip={vi.fn()}
    />,
  );
  for (const name of [
    "First position",
    "Previous move",
    "Next move",
    "Last position",
    "Flip board",
  ]) {
    const button = screen.getByRole("button", { name });
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("title", name);
  }
});
