import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isRecord } from "../src/api/validation";
import {
  answer,
  guidanceAnalysis,
  guidanceGame,
  lessons,
  refusal,
} from "../src/testFixtures/coaching";
import { archive, listing } from "../src/testFixtures/discovery";

type Coach = "ok" | "outage";

function luminance(hex: string): number {
  const parts = hex.replace("#", "").match(/../g);
  if (!parts || parts.length !== 3) throw new Error("Invalid color");
  const linear = parts.map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (
    (linear[0] ?? 0) * 0.2126 +
    (linear[1] ?? 0) * 0.7152 +
    (linear[2] ?? 0) * 0.0722
  );
}

async function mockGuidance(page: Page, coach: { mode: Coach }) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/lessons"))
      return coach.mode === "outage"
        ? route.fulfill({
            status: 503,
            json: {
              code: "dependencies_unavailable",
              message: "Coach is busy",
              retryable: true,
              request_id: "r1",
            },
          })
        : route.fulfill({ json: lessons });
    if (path.endsWith("/coach")) {
      const body: unknown = route.request().postDataJSON();
      if (coach.mode === "outage")
        return route.fulfill({
          status: 503,
          json: {
            code: "dependencies_unavailable",
            message: "Coach is busy",
            retryable: true,
            request_id: "r1",
          },
        });
      const question = isRecord(body) ? body.question : undefined;
      return route.fulfill({ json: question ? refusal : answer });
    }
    if (path === "/api/v1/analyses" || path.includes("/analyses/"))
      return route.fulfill({ json: guidanceAnalysis });
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/")) return route.fulfill({ json: listing });
    return route.fulfill({ json: guidanceGame });
  });
}

async function openGuidance(page: Page) {
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "1. White: Kh1" }).click();
  await expect(page.getByText("Completed · 1/1 plies")).toBeVisible();
}

test("explains a flagged move in plain words and draws labelled arrows", async ({
  page,
}) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  await expect(page.getByText("Mistake", { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("guidance-desktop.png"),
  });
  await page.getByText("Coach options and alternatives").click();
  const arrows = page.getByRole("list", { name: "Board arrows" });
  await expect(arrows).toContainText("Your move: g1 to h1");
  await expect(arrows).toContainText("Suggestion 1: d1 to d4");
  const parts = () => page.locator(".replay-board svg *").count();
  const withArrows = await parts();
  await page
    .getByRole("checkbox", { name: "Show arrows on the board" })
    .uncheck();
  await expect.poll(parts).toBeLessThan(withArrows);
  await expect(page.getByRole("list", { name: "Board arrows" })).toBeVisible();
  await page.getByText("Coach options and alternatives").click();
});

test("shows continuous coaching with opt-in voice and no chat", async ({
  page,
}) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Ask a chess question" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Coach voice" }),
  ).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Coach voice" }).check();
  await expect(
    page.getByRole("button", { name: "Replay voice" }),
  ).toBeVisible();
});

test("recovers automatic notes on retry without a new analysis", async ({
  page,
}) => {
  const coach: { mode: Coach } = { mode: "outage" };
  await mockGuidance(page, coach);
  await openGuidance(page);
  await expect(page.getByRole("alert")).toContainText("Coach is busy");
  coach.mode = "ok";
  await page.getByRole("button", { name: "Retry move notes" }).click();
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
});

test("guidance works at a phone width without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("guidance-phone.png") });
});

test("thin light-green suggestions remain below pieces with a contrasting edge", async ({
  page,
}) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  const paths = page.locator(".replay-board path[marker-end]");
  await expect(paths).toHaveCount(2);
  await expect(
    page.locator('.replay-board path[stroke="#ACC65B"]'),
  ).toHaveCount(1);
  expect(
    await paths
      .first()
      .locator("..")
      .evaluate((svg) => getComputedStyle(svg).zIndex),
  ).toBe("1");
  for (const path of await paths.all()) {
    await expect(path).toHaveAttribute("opacity", "0.8");
    const filter = await path.evaluate(
      (element) => getComputedStyle(element).filter,
    );
    const rgb = filter.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgb) throw new Error("Missing contrasting arrow outline");
    const stroke = `#${rgb
      .slice(1)
      .map((channel) => Number(channel).toString(16).padStart(2, "0"))
      .join("")}`;
    for (const square of ["#B58B64", "#F0D9B5"]) {
      const values = [luminance(stroke), luminance(square)].sort(
        (a, b) => a - b,
      );
      expect(
        ((values[1] ?? 0) + 0.05) / ((values[0] ?? 0) + 0.05),
      ).toBeGreaterThanOrEqual(3);
    }
  }
  await page.screenshot({
    path: test.info().outputPath("guidance-arrows.png"),
  });
});

test("completes username to Quick, replay, coaching, Deep cancellation and retry", async ({
  page,
}) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous move" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Analysis" }).click();
  const { queuedAnalysis } = await import("../src/testFixtures/analysis");
  let submissions = 0;
  const queued = { ...queuedAnalysis, mode: "deep" };
  await page.route("**/api/v1/analyses", (route) => {
    submissions++;
    return route.fulfill({
      json: submissions === 1 ? queued : { ...guidanceAnalysis, mode: "deep" },
    });
  });
  await page.route("**/api/v1/analyses/**", (route) =>
    route.fulfill({
      json: {
        ...queued,
        state: "cancelled",
        can_cancel: false,
        dispatch_pending: false,
      },
    }),
  );
  await page.getByLabel("Engine settings").click();
  await page.getByLabel("Server review").selectOption("deep");
  await page.getByRole("button", { name: "Run review" }).click();
  const progress = page.getByRole("status", { name: "Analysis progress" });
  await expect(progress).toContainText("Deep · Queued");
  await page.getByRole("button", { name: "Cancel analysis" }).click();
  await expect(progress).toContainText("Cancelled");
  await expect(page.getByText(/Partial evidence retained/)).toBeVisible();
  await page.getByRole("button", { name: "Retry analysis" }).click();
  await expect(progress).toContainText("Deep · Completed");
  await expect(
    page.getByRole("button", { name: "1. White: Kh1" }),
  ).toHaveAttribute("aria-current", "step");
  expect(submissions).toBe(2);
});
