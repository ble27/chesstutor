/** PRD §4, §10 S6; plan.md S6. Manual accessibility gates remain required. */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { imported } from "../../testFixtures/discovery";
import { Replay } from "./Replay";

it("exposes named navigation controls and selected-position announcements", () => {
  render(<Replay game={imported} />);
  const controls = screen.getByRole("navigation", { name: "Replay controls" });
  for (const name of [
    "First position",
    "Previous move",
    "Next move",
    "Last position",
    "Flip board",
  ]) {
    expect(within(controls).getByRole("button", { name })).toHaveAccessibleName(
      name,
    );
  }
  const position = screen.getByRole("status", { name: "Replay position" });
  expect(position).toHaveAttribute("aria-atomic", "true");
  fireEvent.click(screen.getByRole("button", { name: "Next move" }));
  expect(position).toHaveTextContent("After 1. White: e4");
});

it("does not capture keyboard navigation from an editable question region", () => {
  render(<Replay game={imported} />);
  const region = screen.getByRole("region", { name: "Game replay" });
  const editor = document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  region.append(editor);
  editor.focus();
  fireEvent.keyDown(editor, { key: "End" });
  expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
    imported.initial_fen,
  );
  editor.remove();
});

it("provides accessible Quick and Deep analysis actions in the engine panel", () => {
  render(<Replay game={imported} />);
  const engine = screen.getByRole("region", { name: "Engine analysis" });
  expect(
    within(engine).getByRole("button", { name: /quick/i }),
  ).toHaveAccessibleName(/quick/i);
  expect(
    within(engine).getByRole("button", { name: /deep/i }),
  ).toHaveAccessibleName(/deep/i);
});
