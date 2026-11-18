import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { QuestionForm } from "./QuestionForm";

it("disables repeat questions while keeping the thinking announcement outside the busy region", () => {
  render(
    <QuestionForm
      ply={1}
      mover="white"
      level="beginner"
      ask={vi.fn()}
      state={{ status: "asking" }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Explain this move" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: /^Ask$/ })).toBeDisabled();
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Thinking about this position");
  expect(status.closest('[aria-busy="true"]')).toBeNull();
});
