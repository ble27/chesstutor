import { expect, test } from "@playwright/test";
import {
  expansionGame,
  expansionJob,
  expansionNotes,
} from "../src/testFixtures/reviewExpansion";
import { archive, listing } from "../src/testFixtures/discovery";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`compares players and rotates through selected-ply explanations at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let questions = 0;
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/coach")) questions += 1;
      const json = path.endsWith("/lessons")
        ? expansionNotes
        : path.includes("/analyses")
          ? expansionJob
          : path.endsWith("/archives")
            ? archive
            : path.includes("/players/")
              ? listing
              : path.endsWith("/health/ready")
                ? { status: "ready" }
                : expansionGame;
      await route.fulfill({ json });
    });
    await page.goto("/");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByText("Completed · 3/3 plies")).toBeVisible();
    const moves = page.getByRole("region", { name: "Moves", exact: true });
    await expect(moves.getByText("100.0%", { exact: false })).toHaveCount(2);
    const white = moves.getByRole("button", { name: "1. White: e4" });
    const black = moves.getByRole("button", { name: "1... Black: e5" });
    await expect(white).toHaveAccessibleDescription("Best move");
    await expect(black).toHaveAccessibleDescription("Best move");
    expect((await white.boundingBox())?.y).toBe((await black.boundingBox())?.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("classification-summary.png"),
    });
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(page.getByText(/Your pawn moved from e2 to e4/)).toBeVisible();
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(page.getByText(/Your pawn moved from e7 to e5/)).toBeVisible();
    await expect(black).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(
      page.getByText(/Your knight moved from g1 to f3/),
    ).toBeVisible();
    await expect(
      moves.getByRole("button", { name: "2. White: Nf3" }),
    ).toHaveAccessibleDescription("Unclassified");
    await expect(
      page.getByRole("button", { name: "Next move", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Previous move", exact: true })
      .click();
    await expect(page.getByText(/Your pawn moved from e7 to e5/)).toBeVisible();
    expect(questions).toBe(0);
    await page.screenshot({
      path: test.info().outputPath("selected-ply-note.png"),
    });
  });
}
