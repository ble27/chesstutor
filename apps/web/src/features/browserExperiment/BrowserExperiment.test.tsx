import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { imported } from "../../testFixtures/discovery";
import { BrowserExperiment } from "./BrowserExperiment";

it("offers local full-strength review with explicit provisional trust", () => {
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  expect(
    screen.getByRole("button", { name: "Browser Quick review" }),
  ).toBeVisible();
  expect(screen.getByText(/provisional/i)).toBeVisible();
  expect(screen.getByText(/Full Stockfish 17\.1/)).toBeVisible();
});

it("does not submit server engine jobs when starting local review", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValue(new Error("fixture download unavailable"));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("Worker", class UnusedWorker {});
  render(<BrowserExperiment game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Browser Quick review" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /download|unavailable/i,
  );
  expect(
    fetcher.mock.calls.some((call) => call[0] === "/api/v1/analyses"),
  ).toBe(false);
  expect(fetcher).toHaveBeenCalled();
});
