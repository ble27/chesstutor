import { expect, test } from "@playwright/test";
import { archive, imported, listing } from "../src/testFixtures/discovery";

for (const threads of [1, 2]) {
  test(`real full WASM review, refine and cached resume with ${threads} threads`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 }),
    );
    let serverJobs = 0;
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/browser-evidence")) {
        const response = await route.fetch({
          url: `http://127.0.0.1:8012${path}`,
        });
        return route.fulfill({ response });
      }
      if (path === "/api/v1/analyses") serverJobs++;
      if (path.endsWith("/health/ready"))
        return route.fulfill({ json: { status: "ready" } });
      if (path.endsWith("/archives")) return route.fulfill({ json: archive });
      if (path.includes("/players/")) return route.fulfill({ json: listing });
      return route.fulfill({ json: imported });
    });
    await page.goto("/?engine=browser");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await page.getByRole("button", { name: "Open game" }).click();
    await page.getByRole("button", { name: "1. White: e4" }).click();
    await page.getByLabel("Engine threads").selectOption(String(threads));
    await page.getByRole("button", { name: "Browser Quick review" }).click();
    await expect(
      page.getByRole("status", { name: "Browser analysis progress" }),
    ).toContainText("Screening finished", { timeout: 60000 });
    await expect(page.getByText("1/1 plies available")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Engine variations" }),
    ).toBeVisible();
    await expect.poll(() => page.workers().length).toBe(0);
    await page.getByRole("button", { name: "Deepen selected move" }).click();
    await expect(
      page.getByRole("status", { name: "Browser analysis progress" }),
    ).toContainText("Selected move refinement finished", { timeout: 30000 });
    await page.getByRole("button", { name: "Browser Quick review" }).click();
    await expect(
      page.getByRole("status", { name: "Browser analysis progress" }),
    ).toContainText("Screening finished");
    expect(serverJobs).toBe(0);
    expect(await page.getByRole("alert").count()).toBe(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.locator("html").evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });
}
