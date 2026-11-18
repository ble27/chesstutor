import { expect, test } from "@playwright/test";
import { archive, imported, listing } from "../src/testFixtures/discovery";
import { completedAnalysis } from "../src/testFixtures/analysis";

test("free analysis validates branches, publishes real WASM scores, and restores the recorded game", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/sandbox")) {
      const response = await route.fetch({
        url: `http://127.0.0.1:8012${path}`,
      });
      return route.fulfill({ response });
    }
    if (path.endsWith("/lessons"))
      return route.fulfill({
        json: {
          analysis_id: completedAnalysis.id,
          level: "beginner",
          complete: true,
          lessons: [],
        },
      });
    if (path.includes("/analyses"))
      return route.fulfill({ json: completedAnalysis });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/")) return route.fulfill({ json: listing });
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    return route.fulfill({ json: imported });
  });
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Analysis progress" }),
  ).toContainText("Completed");
  await page.getByRole("button", { name: "Engine settings" }).click();
  await page.getByLabel("Local search depth").fill("6");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByLabel("Self-analysis / Free play").check();
  await page.getByLabel("Legal move").selectOption("e2e4");
  await page.getByRole("button", { name: "Play move", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Replay position" }),
  ).toContainText("branch ply 1");
  await expect(
    page.getByRole("img", { name: /Evaluation .*White perspective/ }),
  ).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.positions[1]?.fen ?? "missing",
  );
  await page.getByRole("button", { name: "Undo branch move" }).click();
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.initial_fen,
  );
  await page.getByLabel("Legal move").selectOption("d2d4");
  await page.getByRole("button", { name: "Play move", exact: true }).click();
  await page.getByLabel("Saved branches").selectOption("0");
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.positions[1]?.fen ?? "missing",
  );
  await page.getByLabel("Local suggestion arrows").uncheck();
  await page
    .getByRole("button", { name: "Return to game", exact: true })
    .click();
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.initial_fen,
  );
  await expect(page.getByText(/Client-unverified/)).toHaveCount(0);
  await expect(page.getByLabel("Self-analysis / Free play")).not.toBeChecked();
});
