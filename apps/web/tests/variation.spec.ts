import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { archive, listing } from "../src/testFixtures/discovery";
import {
  analysisGame,
  positionJob,
} from "../src/testFixtures/positionAnalysis";

async function openReview(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/"))
      return route.fulfill({
        json: { ...listing, games: [analysisGame.game] },
      });
    if (path.includes("/analyses")) return route.fulfill({ json: positionJob });
    return route.fulfill({ json: analysisGame });
  });
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Open game" }).click();
  await page.getByRole("button", { name: "Quick review" }).click();
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`stored variation and return restore the game at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openReview(page);
    await page.getByRole("button", { name: "Next move" }).click();
    const evaluation = page.locator(".position-score strong");
    await expect(evaluation).toHaveText("-0.35");
    await page.getByRole("button", { name: "Explore variation 1" }).click();
    await expect(evaluation).toHaveCount(0);
    await page.getByText("Text position and FEN").click();
    await page.getByRole("button", { name: "Next move" }).click();
    await expect(page.getByLabel("Position FEN")).toHaveText(
      analysisGame.positions[2]?.fen ?? "missing",
    );
    await expect(
      page.getByRole("button", { name: "Next move" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Flip board" }).click();
    await page.getByRole("button", { name: "Return to game" }).click();
    await expect(page.getByLabel("Position FEN")).toHaveText(
      analysisGame.positions[1]?.fen ?? "missing",
    );
    await expect(evaluation).toHaveText("-0.35");
    await expect(
      page.getByRole("button", { name: "Explore variation 1" }),
    ).toBeFocused();
    await expect(
      page.getByRole("img", { name: "Chessboard, Black at bottom" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "1. White: e4" }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByText("Text position and FEN").click();
    if (width === 320 || width === 1440)
      await page
        .locator(".workspace")
        .screenshot({ path: `/tmp/chesstutor-s6-variation-${width}.png` });
  });
}
