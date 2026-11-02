import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`service shell is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/health/ready", (route) =>
      route.fulfill({ json: { status: "ready" } }),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Understand every move.",
    );
    await expect(page.getByRole("status")).toHaveText(
      "Review service connected",
    );
    await expect(
      page.getByRole("heading", { name: "Chess guidance" }),
    ).toBeVisible();
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
