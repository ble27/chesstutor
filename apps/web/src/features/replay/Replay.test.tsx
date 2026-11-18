import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { imported } from "../../testFixtures/discovery";
import { replayFixtures } from "../../testFixtures/replay";
import { Replay } from "./Replay";

it("groups engine analysis above the selectable game moves", () => {
  render(<Replay game={imported} />);
  const review = screen.getByRole("complementary", { name: "Game insights" });
  const engine = within(review).getByRole("heading", {
    name: "Engine",
  });
  const moves = within(review).getByRole("list", { name: "Game moves" });
  expect(
    engine.compareDocumentPosition(moves) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(within(moves).getByRole("button", { name: "1. White: e4" }));
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  );
});

it("keeps player names and piece colors at the matching board edges when flipped", () => {
  render(<Replay game={imported} />);
  const top = screen.getByRole("group", { name: "Top player" });
  const bottom = screen.getByRole("group", { name: "Bottom player" });
  expect(within(top).getByText("bobby")).toBeVisible();
  expect(within(top).getByText("Black pieces")).toBeVisible();
  expect(within(bottom).getByText("alice")).toBeVisible();
  expect(within(bottom).getByText(/White pieces/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(within(top).getByText("alice")).toBeVisible();
  expect(within(top).getByText(/White pieces/)).toBeVisible();
  expect(within(bottom).getByText("bobby")).toBeVisible();
  expect(within(bottom).getByText("Black pieces")).toBeVisible();
  expect(screen.getByRole("button", { name: "1. White: e4" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(
    screen.getByRole("img", { name: "Chessboard, Black at bottom" }),
  ).toHaveAccessibleDescription(/alice.*White pieces.*bobby.*Black pieces/);
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(within(top).getByText("bobby")).toBeVisible();
});

it("starts at the imported initial position and bounds forward/backward navigation", () => {
  render(<Replay game={imported} />);
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
  expect(screen.getByRole("button", { name: "First position" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous move" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  );
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Last position" })).toBeDisabled();
  const moves = screen.getByRole("list", { name: "Game moves" });
  expect(
    within(moves).getByRole("button", { name: "1. White: e4" }),
  ).toHaveAttribute("aria-current", "step");
  fireEvent.click(screen.getByRole("button", { name: "Previous move" }));
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
});

it("describes the selected position in text after en passant", () => {
  const fixture = replayFixtures.find(
    (fixture) => fixture.name === "en passant",
  );
  if (!fixture) throw new Error("Missing fixture");
  render(<Replay game={fixture.game} />);
  fireEvent.click(screen.getByRole("button", { name: "Last position" }));
  expect(
    screen.getByRole("status", { name: "Replay position" }),
  ).toHaveTextContent("After 13. White: exd6 · Black to move");
  const pieces = screen.getByRole("table", { name: "Position pieces" });
  expect(
    within(pieces).getByRole("row", { name: "d6 White pawn" }),
  ).toBeVisible();
  expect(
    within(pieces).queryByRole("row", { name: /Black pawn/ }),
  ).not.toBeInTheDocument();
});

it("handles focused Arrow/Home/End keys, bounds endpoints, and leaves typing alone", () => {
  render(
    <>
      <label>
        Question
        <input />
      </label>
      <Replay game={imported} />
    </>,
  );
  const region = screen.getByRole("region", { name: "Game replay" });
  region.focus();
  expect(region).toHaveFocus();
  fireEvent.keyDown(region, { key: "ArrowLeft" });
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
  fireEvent.keyDown(region, { key: "ArrowRight" });
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
  fireEvent.keyDown(region, { key: "ArrowRight" });
  fireEvent.keyDown(region, { key: "Home" });
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
  fireEvent.keyDown(region, { key: "End" });
  const question = screen.getByRole("textbox", { name: "Question" });
  question.focus();
  const event = new KeyboardEvent("keydown", {
    key: "Home",
    bubbles: true,
    cancelable: true,
  });
  fireEvent(question, event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
  fireEvent.keyDown(region, { key: "Home", ctrlKey: true });
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
});

it("renders the imported board and flips orientation without changing selection", () => {
  const fixture = replayFixtures.find((fixture) => fixture.name === "castling");
  if (!fixture) throw new Error("Missing fixture");
  render(<Replay game={fixture.game} />);
  fireEvent.click(screen.getByRole("button", { name: "Last position" }));
  const board = screen.getByRole("img", {
    name: "Chessboard, White at bottom",
  });
  expect(
    board.querySelector('[data-square="g1"] [data-piece="wK"]'),
  ).not.toBeNull();
  expect(
    board.querySelector('[data-square="f1"] [data-piece="wR"]'),
  ).not.toBeNull();
  expect(
    board.querySelector('[data-square="c8"] [data-piece="bK"]'),
  ).not.toBeNull();
  expect(
    board.querySelector('[data-square="d8"] [data-piece="bR"]'),
  ).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  expect(
    screen.getByRole("img", { name: "Chessboard, Black at bottom" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    "2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2",
  );
  expect(
    screen.getByRole("button", { name: "1... Black: O-O-O" }),
  ).toHaveAttribute("aria-current", "step");
});

it("pairs moves by the starting FEN full-move number and color", () => {
  const fixture = replayFixtures.find(
    (fixture) => fixture.name === "Black-to-move setup",
  );
  if (!fixture) throw new Error("Missing fixture");
  render(<Replay game={fixture.game} />);
  fireEvent.click(screen.getByRole("button", { name: "17... Black: e5" }));
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 18",
  );
  expect(screen.getByRole("button", { name: "18. White: Nf3" })).toBeVisible();
});

it("starts a newly opened game version at its initial position and default orientation", () => {
  const { rerender } = render(<Replay game={imported} />);
  fireEvent.click(screen.getByRole("button", { name: "Last position" }));
  fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
  rerender(<Replay game={{ ...imported, version: 2 }} />);
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
  expect(
    screen.getByRole("img", { name: "Chessboard, White at bottom" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Previous move" })).toBeDisabled();
});
