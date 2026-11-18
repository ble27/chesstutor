import { selectOption } from "./ui";
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
  await page.getByRole("button", { name: "Engine settings" }).click();
  await page.getByLabel("Local search depth").fill("6");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("tab", { name: "Self-analysis" }).click();
  await expect(page.getByRole("combobox", { name: "Legal move" })).toHaveCount(
    0,
  );
  const board = page.getByRole("group", { name: "Play on board" });
  const e2 = board.getByRole("button", { name: "e2, White pawn" });
  await expect(e2).toBeEnabled();
  await e2.press("Enter");
  await expect(e2).toHaveAttribute("aria-pressed", "true");
  await board.getByRole("button", { name: "e4, Empty" }).press("Enter");
  await expect(
    page.getByRole("status", { name: "Replay position" }),
  ).toContainText("e4");
  await expect(
    page
      .getByRole("list", { name: "Local engine variations" })
      .getByRole("listitem"),
  ).toHaveCount(2, { timeout: 45000 });
  await expect(
    page.getByRole("img", { name: /Evaluation .*White perspective/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.positions[1]?.fen ?? "missing",
  );
  await page.getByRole("button", { name: "Previous move" }).click();
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.initial_fen,
  );
  const d2 = board.getByRole("button", { name: "d2, White pawn" });
  await expect(d2).toBeEnabled();
  await page.locator('.replay-board [data-square="d2"]').click();
  await page.locator('.replay-board [data-square="d4"]').click();
  await expect(
    page.getByRole("status", { name: "Replay position" }),
  ).toContainText("d4");
  await selectOption(page, "Saved branches", "Branch 1 · 1 plies");
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.positions[1]?.fen ?? "missing",
  );
  await page.getByRole("checkbox", { name: "Engine arrows" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Engine arrows" }),
  ).not.toBeChecked();
  await page.screenshot({
    path: test.info().outputPath("self-analysis.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page.getByLabel("Position FEN")).toHaveText(
    imported.initial_fen,
  );
  await expect(board).toHaveCount(0);
});
