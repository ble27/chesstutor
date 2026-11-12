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
    await page.getByRole("button", { name: "Open game" }).click();
    await page.getByRole("button", { name: "Quick review" }).click();
    await expect(page.getByText("Completed · 3/3 plies")).toBeVisible();
    await page.getByRole("tab", { name: "Review", exact: true }).click();
    const table = page.getByRole("table", {
      name: "Move classifications by player",
    });
    await expect(
      table.getByRole("columnheader", { name: /alice.*White/ }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: /bobby.*Black/ }),
    ).toBeVisible();
    await expect(
      table.getByRole("row", { name: "Best move 1 1" }),
    ).toBeVisible();
    await expect(
      table.getByRole("row", { name: "Unclassified 1 0" }),
    ).toBeVisible();
    await expect(
      table.getByRole("row", { name: "Chess Tutor accuracy 100.0% 100.0%" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("classification-summary.png"),
    });
    await page.getByRole("tab", { name: "Chess guidance" }).click();
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(page.getByText(/Your pawn moved from e2 to e4/)).toBeVisible();
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(page.getByText(/Your pawn moved from e7 to e5/)).toBeVisible();
    await expect(page.getByText("Ply 2 · Black move")).toBeVisible();
    await expect(
      page.getByText("Base label: best · Expected-score loss: 0.0%"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(
      page.getByText(/Your knight moved from g1 to f3/),
    ).toBeVisible();
    await expect(
      page
        .getByRole("tabpanel", { name: "Chess guidance" })
        .getByText("Unclassified", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Base label: unclassified · Expected-score loss: unavailable",
      ),
    ).toBeVisible();
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
