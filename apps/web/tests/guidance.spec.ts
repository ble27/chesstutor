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
    if (path.endsWith("/lessons")) return route.fulfill({ json: lessons });
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
  await page.getByRole("button", { name: "Open game" }).click();
  await page.getByRole("button", { name: "1. White: Kh1" }).click();
  await page.getByRole("button", { name: "Quick review" }).click();
  await expect(page.getByText("Completed · 1/1 plies")).toBeVisible();
  await page.getByRole("tab", { name: "Chess guidance" }).click();
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
  await page.screenshot({
    path: test.info().outputPath("guidance-desktop.png"),
  });
});

test("answers a supported question and refuses an unrelated one", async ({
  page,
}) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  await page.getByRole("button", { name: "Explain this move" }).click();
  await expect(
    page.getByText(/can capture the opponent's queen/),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Ask a chess question" })
    .fill("Write a soup recipe.");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(
    page.getByText(/Choose a chess question about this game/),
  ).toBeVisible();
});

test("keeps the move note when the coach is unavailable and recovers on retry", async ({
  page,
}) => {
  const coach: { mode: Coach } = { mode: "outage" };
  await mockGuidance(page, coach);
  await openGuidance(page);
  await page.getByRole("button", { name: "Explain this move" }).click();
  await expect(page.getByRole("alert")).toContainText("Coach is busy");
  await expect(
    page.getByText(/leaves your rook on d1 undefended/),
  ).toBeVisible();
  coach.mode = "ok";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText(/can capture the opponent's queen/),
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

test("guidance arrows contrast with both board squares", async ({ page }) => {
  await mockGuidance(page, { mode: "ok" });
  await openGuidance(page);
  const paths = page.locator(".replay-board path[marker-end]");
  await expect(paths).toHaveCount(2);
  for (const path of await paths.all()) {
    await expect(path).toHaveAttribute("opacity", "1");
    const stroke = await path.getAttribute("stroke");
    if (!stroke) throw new Error("Missing arrow color");
    for (const square of ["#637878", "#e0dfd5"]) {
      const values = [luminance(stroke), luminance(square)].sort(
        (a, b) => a - b,
      );
      expect(
        ((values[1] ?? 0) + 0.05) / ((values[0] ?? 0) + 0.05),
      ).toBeGreaterThanOrEqual(3);
    }
  }
});
