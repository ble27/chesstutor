import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { isRecord } from "../src/api/validation";
import { completedAnalysis } from "../src/testFixtures/analysis";
import { answer, lessons, refusal } from "../src/testFixtures/coaching";
import { archive, imported, listing } from "../src/testFixtures/discovery";

type Coach = "ok" | "outage";

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
      return route.fulfill({ json: completedAnalysis });
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/")) return route.fulfill({ json: listing });
    return route.fulfill({ json: imported });
  });
}

async function openGuidance(page: Page) {
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Open game" }).click();
  await page.getByRole("button", { name: "1. White: e4" }).click();
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
});
