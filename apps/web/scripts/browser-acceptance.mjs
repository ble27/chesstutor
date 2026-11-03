// Optional local acceptance experiment against an already imported game.
// Usage: node scripts/browser-acceptance.mjs /absolute/path/to/game-response.json
import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";
import { Console } from "node:console";
import { chromium, expect } from "@playwright/test";

const game = JSON.parse(await readFile(process.argv[2], "utf8"));
const output = new Console(process.stdout);
if (
  !Array.isArray(game.positions) ||
  game.positions.length < 2 ||
  game.positions.length > 301
)
  throw new Error("Expected a bounded imported GameResponse fixture");
const browser = await chromium.launch({ headless: true });
try {
  for (const threads of [1, 2]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    let submissions = 0;
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/browser-evidence")) return route.continue();
      if (path === "/api/v1/analyses") submissions++;
      if (path.endsWith("/health/ready"))
        return route.fulfill({ json: { status: "ready" } });
      if (path.endsWith("/archives"))
        return route.fulfill({
          json: {
            username: "alice",
            months: ["2026-11"],
            fetched_at: "2026-11-03T12:00:00Z",
            stale: false,
          },
        });
      if (path.includes("/players/"))
        return route.fulfill({
          json: {
            games: [game.game],
            next_cursor: null,
            fetched_at: "2026-11-03T12:00:00Z",
            stale: false,
          },
        });
      return route.fulfill({ json: game });
    });
    await page.goto("http://127.0.0.1:5175/?engine=browser");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await page.getByRole("button", { name: "Open game" }).click();
    await page.getByLabel("Engine threads").selectOption(String(threads));
    const progress = page.getByRole("status", {
      name: "Browser analysis progress",
    });
    const started = Date.now();
    await page.getByRole("button", { name: "Browser Quick review" }).click();
    if (threads === 1) {
      await expect
        .poll(
          () =>
            page
              .getByRole("progressbar", { name: "Browser analysed plies" })
              .getAttribute("value"),
          { timeout: 90000 },
        )
        .not.toBe("0");
      await page
        .getByRole("button", { name: "Cancel browser analysis" })
        .click();
      await expect.poll(() => page.workers().length).toBe(0);
      const retained = await page
        .getByRole("progressbar", { name: "Browser analysed plies" })
        .getAttribute("value");
      output.log(
        JSON.stringify({
          threads,
          cancellation_reaped_workers: true,
          retained,
        }),
      );
      await page.getByRole("button", { name: "Browser Quick review" }).click();
    }
    await expect(progress).toContainText("Screening finished", {
      timeout: 120000,
    });
    await expect(
      page.getByText(
        `${game.positions.length - 1}/${game.positions.length - 1} plies available`,
      ),
    ).toBeVisible();
    await expect.poll(() => page.workers().length).toBe(0);
    output.log(
      JSON.stringify({
        threads,
        plies: game.positions.length - 1,
        wall_seconds_including_download_cancel_resume:
          (Date.now() - started) / 1000,
        status: await progress.textContent(),
        server_job_submissions: submissions,
      }),
    );
    await page.screenshot({
      path: `/tmp/chesstutor-browser-${threads}.png`,
      fullPage: true,
    });
    const cachedStarted = Date.now();
    await page.getByRole("button", { name: "Browser Quick review" }).click();
    await expect(progress).toContainText("Screening finished");
    output.log(
      JSON.stringify({
        threads,
        cached_review_seconds: (Date.now() - cachedStarted) / 1000,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
