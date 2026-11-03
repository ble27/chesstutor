import { expect, test } from "@playwright/test";
import { archive, imported, listing } from "../src/testFixtures/discovery";

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`finds and opens a public game at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/health/ready"))
        return route.fulfill({ json: { status: "ready" } });
      if (url.pathname.endsWith("/archives"))
        return route.fulfill({ json: archive });
      if (url.pathname.includes("/players/"))
        return route.fulfill({ json: { ...listing, stale: true } });
      return route.fulfill({ json: imported });
    });
    await page.goto("/");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await expect(page.getByLabel("Archive month")).toHaveValue("2026-11");
    await expect(page.getByText(/Stale cached data/)).toBeVisible();
    await expect(page.getByText(/White: alice/)).toBeVisible();
    await page.getByLabel("Player color").selectOption("black");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await page.getByRole("button", { name: "Open game" }).click();
    await expect(
      page.getByRole("heading", { name: "Game imported" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "1. White: e4" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("distinguishes absent player, empty history, and provider timeout", async ({
  page,
}) => {
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({ json: { status: "ready" } }),
  );
  await page.route("**/archives", (route) => {
    if (route.request().url().includes("empty"))
      return route.fulfill({
        json: { ...archive, username: "empty", months: [] },
      });
    const absent = route.request().url().includes("missing");
    return route.fulfill({
      status: absent ? 404 : 503,
      json: {
        code: absent ? "player_not_found" : "upstream_timeout",
        message: absent
          ? "No public archive was found for this player or month."
          : "Chess.com took too long to respond.",
        retryable: !absent,
        request_id: "fixture",
      },
    });
  });
  await page.goto("/");
  for (const [username, expected] of [
    ["missing", "No public archive was found"],
    ["empty", "No public games are available"],
    ["timeout", "Chess.com took too long"],
  ]) {
    await page.getByLabel("Chess.com username").fill(username ?? "");
    await page.getByRole("button", { name: "Find games" }).click();
    await expect(page.getByText(new RegExp(expected ?? ""))).toBeVisible();
  }
});
