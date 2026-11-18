import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  archive,
  imported,
  listing,
  summary,
} from "../src/testFixtures/discovery";
import { verifiedGreatAnalysis } from "../src/testFixtures/analysis";

async function mockLibrary(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (url.pathname.endsWith("/ratings"))
      return route.fulfill({
        json: {
          username: "alice",
          rapid: 1512,
          blitz: 1324,
          bullet: 1258,
          fetched_at: archive.fetched_at,
          stale: false,
        },
      });
    if (url.pathname.endsWith("/archives"))
      return route.fulfill({ json: archive });
    if (url.pathname.includes("/players/"))
      return route.fulfill({
        json: {
          ...listing,
          games: [
            { ...summary, move_count: 1 },
            {
              ...summary,
              id: "381e6db7-0719-5a45-bade-18c73a8b2222",
              time_class: "blitz",
              move_count: 32,
              end_time: "2026-10-31T12:00:00Z",
              white: {
                username: "opponent-with-a-long-name",
                rating: 1250,
                result: "resigned",
              },
              black: { username: "alice", rating: 1324, result: "win" },
            },
          ],
        },
      });
    if (url.pathname.includes("/analyses"))
      return route.fulfill({
        json: { ...verifiedGreatAnalysis, cached: true },
      });
    return route.fulfill({ json: imported });
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`unified game library and review at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockLibrary(page);
    await page.goto("/");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await expect(page.getByText("1512", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Recent games" }).getByRole("listitem"),
    ).toHaveCount(2);
    await expect(page.getByText("32 moves", { exact: true })).toBeVisible();
    const filter = page.getByRole("group", { name: "Filter by time control" });
    await filter.getByRole("button", { name: "Blitz" }).click();
    await expect(filter.getByRole("button", { name: "Blitz" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await filter.getByRole("button", { name: "All games" }).click();
    if (process.env.CAPTURE_UI && [390, 1440].includes(width)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `../../.impeccable/review/library-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Analyze" }).first().click();
    await expect(
      page.getByRole("region", { name: "Game replay" }),
    ).toBeFocused();
    await page.getByLabel("Engine settings").click();
    await page.getByLabel("Server review").selectOption("deep");
    await page.getByRole("button", { name: "Run review" }).click();
    await page.getByRole("button", { name: "Next move" }).click();
    await expect(page.locator(".position-score strong")).toBeVisible();
    await page.getByRole("tab", { name: "Review", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Classification summary" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Analysis", exact: true }).click();
    if (width >= 1024) {
      const board = await page.locator(".board-frame").boundingBox();
      const analysis = await page
        .getByRole("region", { name: "Game review", exact: true })
        .boundingBox();
      expect(board && analysis && board.width / analysis.width).toBeCloseTo(
        1.5,
        1,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (process.env.CAPTURE_UI && [390, 1440].includes(width)) {
      await page.locator("#review-workspace").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `../../.impeccable/review/workspace-${width}.png`,
        fullPage: true,
      });
    }
  });
}
