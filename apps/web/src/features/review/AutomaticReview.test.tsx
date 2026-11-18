import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Replay } from "../replay/Replay";
import { imported } from "../../testFixtures/discovery";
import { queuedAnalysis } from "../../testFixtures/analysis";
it("starts one default review in Strict Mode and puts preset actions in settings", async () => {
  const fetcher = vi.fn((url: string) =>
    Promise.resolve(
      Response.json(
        url.includes("/lessons")
          ? {
              analysis_id: queuedAnalysis.id,
              level: "beginner",
              complete: false,
              lessons: [],
            }
          : queuedAnalysis,
      ),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <StrictMode>
      <Replay game={imported} automatic />
    </StrictMode>,
  );
  await screen.findByRole("status", { name: "Analysis progress" });
  await waitFor(() =>
    expect(
      fetcher.mock.calls.filter(([url]) => url === "/api/v1/analyses"),
    ).toHaveLength(1),
  );
  expect(
    screen.queryByRole("button", { name: "Quick review" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("tab", { name: "Chess guidance" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Settings")).toBeInTheDocument();
});
