import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { archive, listing } from "../src/testFixtures/discovery";
import { queuedAnalysis } from "../src/testFixtures/analysis";
import { replayFixtures } from "../src/testFixtures/replay";
import {
  expansionGame,
  expansionJob,
  expansionNotes,
} from "../src/testFixtures/reviewExpansion";

async function mockReview(page: Page, long = false) {
  const game = long
    ? replayFixtures.find(({ name }) => name === "opening")?.game
    : expansionGame;
  if (!game) throw new Error("Missing fixture");
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (pathname.endsWith("/archives")) return route.fulfill({ json: archive });
    if (pathname.endsWith("/ratings"))
      return route.fulfill({
        json: {
          username: "alice",
          rapid: 1540,
          blitz: 1386,
          bullet: 1204,
          fetched_at: archive.fetched_at,
          stale: false,
        },
      });
    if (pathname.includes("/players/"))
      return route.fulfill({
        json: {
          ...listing,
          games: [
            {
              ...game.game,
              move_count: Math.ceil((game.positions.length - 1) / 2),
            },
          ],
        },
      });
    if (pathname.endsWith("/lessons"))
      return route.fulfill({ json: expansionNotes });
    if (pathname.includes("/analyses"))
      return route.fulfill({
        json: long
          ? {
              ...queuedAnalysis,
              game_id: game.game.id,
              total_plies: game.positions.length - 1,
            }
          : expansionJob,
      });
    return route.fulfill({ json: game });
  });
}

async function search(page: Page) {
  await page.goto("/");
  await expect(page.getByText("Understand every move.")).toHaveCount(0);
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await expect(page.getByText("1540")).toBeVisible();
}

async function openReview(page: Page) {
  await search(page);
  await page.getByRole("button", { name: "Analyze", exact: true }).click();
  await expect(page.getByRole("region", { name: "Game replay" })).toBeVisible();
}

async function getScrollers(page: Page) {
  return page
    .locator(".app *")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 1 &&
            /^(auto|scroll)$/.test(getComputedStyle(element).overflowY),
        )
        .map((element) => element.className),
    );
}

for (const width of [320, 390, 1024, 1366, 1440]) {
  test(`flat search and paired analysis at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 768 });
    await mockReview(page);
    await search(page);
    expect(await getScrollers(page)).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath("library.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Analyze", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Game replay" }),
    ).toBeVisible();
    await expect(page.locator("details")).toHaveCount(0);
    const tab = page.getByRole("tab", { name: "Analysis", exact: true });
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await tab.focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Report" })).toBeFocused();
    await page.keyboard.press("Enter");
    const row = page
      .getByRole("list", { name: "Game moves" })
      .getByRole("listitem")
      .first();
    const white = row.getByRole("button", { name: "1. White: e4" });
    const black = row.getByRole("button", { name: "1... Black: e5" });
    expect((await white.boundingBox())?.y).toBe((await black.boundingBox())?.y);
    await expect(white).toHaveAccessibleDescription("Best move");
    await expect(black).toHaveAccessibleDescription("Best move");
    await page.screenshot({
      path: test.info().outputPath("report.png"),
      fullPage: true,
    });
    await tab.click();
    await expect(page.getByRole("list", { name: "Game moves" })).toHaveCount(0);
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    const score = page.locator(".evaluation-rail strong");
    await expect(score).toHaveText("-0.35");
    expect(
      await score.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await expect(page.getByText("-0.35", { exact: true })).toHaveCount(1);
    await expect(page.getByText(/^Depth [0-9]/)).toHaveCount(1);
    await expect(
      page.getByRole("region", { name: "Move coach" }),
    ).toContainText("e2 to e4");
    await expect(page.locator(".coach-avatar")).toHaveJSProperty(
      "naturalWidth",
      160,
    );
    if (width >= 1024) {
      expect(await getScrollers(page)).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      for (const name of ["Engine analysis", "Move coach"])
        await expect(
          page.getByRole("region", { name, exact: true }),
        ).toBeInViewport({ ratio: 1 });
    } else {
      expect(await getScrollers(page)).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.getByRole("button", { name: "Engine settings" }).click();
    await expect(
      page.getByRole("dialog", { name: "Engine settings" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Engine settings" }),
    ).toBeFocused();
    await page.evaluate(
      () =>
        document.activeElement instanceof HTMLElement &&
        document.activeElement.blur(),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: test.info().outputPath("workspace.png"),
      fullPage: true,
    });
  });
}

test("a long report uses page scrolling and includes every recorded ply", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 620 });
  await mockReview(page, true);
  await openReview(page);
  await page.getByRole("button", { name: "Last position" }).click();
  await page.getByRole("tab", { name: "Report" }).click();
  await expect(
    page.getByRole("list", { name: "Game moves" }).getByRole("button"),
  ).toHaveCount(20);
  const last = page.getByRole("button", { name: "10... Black: Nbd7" });
  await expect(last).toHaveAttribute("aria-current", "step");
  await expect(last).toHaveAccessibleDescription("Awaiting analysis");
  expect(await getScrollers(page)).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > innerHeight,
    ),
  ).toBe(true);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});

test("coach playback is click-only and stops on navigation", async ({
  page,
}) => {
  await mockReview(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      value: () => Promise.resolve(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      value: () => undefined,
    });
  });
  let requests = 0;
  await page.route("**/lessons/*/audio", (route) => {
    requests++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postData()).toBeNull();
    return route.fulfill({ contentType: "audio/mpeg", body: "ID3 fixture" });
  });
  await openReview(page);
  await page.getByRole("button", { name: "Next move" }).click();
  const play = page.getByRole("button", { name: "Play coach voice" });
  await expect(play).toBeEnabled();
  expect(requests).toBe(0);
  await play.click();
  const pause = page.getByRole("button", { name: "Pause coach voice" });
  await expect(pause).toBeVisible();
  const mute = page.getByRole("button", { name: "Mute coach" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("audio")).toHaveJSProperty("muted", true);
  await mute.click();
  await pause.click();
  await play.click();
  await expect(pause).toBeVisible();
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(play).toBeEnabled();
  await expect(pause).toHaveCount(0);
  expect(requests).toBe(1);
});
