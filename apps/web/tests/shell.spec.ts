import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`service shell is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/health/ready", (route) =>
      route.fulfill({ json: { status: "ready" } }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Chess Tutor home" }),
    ).toBeVisible();
    await expect(page.getByLabel("Chess.com username")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Find games" }),
    ).toBeVisible();
    await expect(page.getByRole("heading")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("service failure is explained", async ({ page }) => {
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "dependencies_unavailable",
        message: "Services are starting",
        retryable: true,
        request_id: "fixture",
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "Review service unavailable",
  );
});
