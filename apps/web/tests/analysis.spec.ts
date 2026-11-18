import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isRecord } from "../src/api/validation";
import { archive, imported, listing } from "../src/testFixtures/discovery";
import {
  completedAnalysis,
  queuedAnalysis,
  verifiedGreatAnalysis,
} from "../src/testFixtures/analysis";

async function openGame(page: Page) {
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "1. White: e4" }).click();
}

async function mockJourney(page: Page) {
  let mode: "quick" | "deep" = "quick";
  let submissions = 0,
    polls = 0,
    cancelling = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const id =
      mode === "quick"
        ? queuedAnalysis.id
        : "29d55620-670a-434b-8ae0-8d2d6be07c12";
    if (path.endsWith("/cancel")) {
      cancelling = true;
      return route.fulfill({
        json: { ...queuedAnalysis, id, mode, state: "cancel_requested" },
      });
    }
    if (path === "/api/v1/analyses") {
      const payload: unknown = route.request().postDataJSON();
      if (
        !isRecord(payload) ||
        (payload.mode !== "quick" && payload.mode !== "deep")
      )
        throw new Error("Invalid preset request");
      mode = payload.mode;
      submissions++;
      polls = 0;
      cancelling = false;
      const nextId =
        mode === "quick"
          ? queuedAnalysis.id
          : "29d55620-670a-434b-8ae0-8d2d6be07c12";
      return route.fulfill({
        json: {
          ...(submissions >= 3 ? completedAnalysis : queuedAnalysis),
          id: nextId,
          mode,
        },
      });
    }
    if (path.includes("/analyses/")) {
      polls++;
      const data = cancelling
        ? {
            ...queuedAnalysis,
            state: "cancelled",
            can_cancel: false,
            dispatch_pending: false,
          }
        : polls >= 2
          ? completedAnalysis
          : {
              ...queuedAnalysis,
              state: "running",
              attempts: 1,
              dispatch_pending: false,
            };
      return route.fulfill({ json: { ...data, id, mode } });
    }
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/")) return route.fulfill({ json: listing });
    return route.fulfill({ json: imported });
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Quick/replay/Deep/cancel/retry journey at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockJourney(page);
    await openGame(page);
    const status = page.getByRole("status", { name: "Analysis progress" });
    await expect(status).toContainText("Queued · 0/1 plies");
    await page.getByRole("button", { name: "Flip board" }).click();
    await expect(status).toContainText("Completed · 1/1 plies", {
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: "1. White: e4" }),
    ).toHaveAttribute("aria-current", "step");
    await expect(page.locator(".position-score strong")).toBeVisible();
    await expect(page.getByText("White evaluation · after e4")).toBeVisible();
    await page.getByLabel("Engine settings").click();
    await page.getByLabel("Server review").selectOption("deep");
    await page.getByRole("button", { name: "Run review" }).click();
    await expect(status).toContainText("Deep · Queued");
    await page.getByRole("button", { name: "Cancel analysis" }).click();
    await expect(status).toContainText("Cancelled", { timeout: 10000 });
    await expect(page.getByText(/Partial evidence retained/)).toBeVisible();
    await page.getByRole("button", { name: "Retry analysis" }).click();
    await expect(status).toContainText("Deep · Completed");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 390 || width === 1440)
      await page
        .locator(".workspace")
        .screenshot({ path: `/tmp/chesstutor-s3-${width}.png` });
  });
}

test("explains worker outage and shared-network quota without claiming completion", async ({
  page,
}) => {
  await mockJourney(page);
  await page.route("**/api/v1/analyses", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "engine_unavailable",
        message: "Analysis workers are not ready.",
        retryable: true,
        request_id: "fixture",
        retry_after_seconds: 5,
      },
    }),
  );
  await openGame(page);
  await expect(page.getByRole("alert")).toContainText(
    "Analysis workers are not ready.",
  );
  await page.route("**/api/v1/analyses", (route) =>
    route.fulfill({
      status: 429,
      json: {
        code: "ip_quota",
        message: "Shared-network analysis quota reached.",
        retryable: true,
        request_id: "fixture",
        retry_after_seconds: 60,
      },
    }),
  );
  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect(page.getByRole("alert")).toContainText("Retry in 60 seconds.");
  await expect(
    page.getByRole("status", { name: "Analysis progress" }),
  ).toHaveCount(0);
});

test("verified classification proof follows the selected ply", async ({
  page,
}) => {
  await mockJourney(page);
  await page.route("**/api/v1/analyses", (route) =>
    route.fulfill({ json: { ...verifiedGreatAnalysis, cached: true } }),
  );
  await openGame(page);
  await page.getByLabel("Engine settings").click();
  await page.getByLabel("Server review").selectOption("deep");
  await page.getByRole("button", { name: "Run review" }).click();
  await expect(page.getByText("Great", { exact: true })).toBeVisible();
  await expect(page.getByText("Checked supporting line: d4")).toBeVisible();
  await expect(page.getByText(/Practice: calculation/)).toBeVisible();
  await expect(page.getByText(/Brilliant is a heuristic/)).toBeVisible();
  await page.getByRole("button", { name: "First position" }).click();
  await expect(page.getByText("Great", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Last position" }).click();
  await expect(page.getByText("Checked supporting line: d4")).toBeVisible();
});
