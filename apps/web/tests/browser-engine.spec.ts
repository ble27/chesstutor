import { expect, test, type Page } from "@playwright/test";
import { archive, imported, listing } from "../src/testFixtures/discovery";

async function fixtureRoutes(page: Page, submitted: () => void) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/browser-evidence")) {
      const response = await route.fetch({
        url: `http://127.0.0.1:8012${path}`,
      });
      return route.fulfill({ response });
    }
    if (path === "/api/v1/analyses") submitted();
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/")) return route.fulfill({ json: listing });
    return route.fulfill({ json: imported });
  });
}

// Observe the actual worker without substituting its script, messages or output.
async function observeEngine(page: Page): Promise<string[]> {
  const lines: string[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("stockfish-proof:"))
      lines.push(message.text().slice("stockfish-proof:".length));
  });
  await page.addInitScript(() => {
    const RealWorker = window.Worker;
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        this.addEventListener("message", (event: MessageEvent<unknown>) => {
          if (typeof event.data === "string")
            console.debug(`stockfish-proof:${event.data}`);
        });
      }
    };
  });
  return lines;
}

for (const threads of [1, 2]) {
  test(`real full WASM review, refine and cached resume with ${threads} threads`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 4 }),
    );
    let serverJobs = 0;
    const engineOutput = await observeEngine(page);
    await fixtureRoutes(page, () => serverJobs++);
    await page.goto("/?engine=browser");
    await page.getByLabel("Chess.com username").fill("alice");
    await page.getByRole("button", { name: "Find games" }).click();
    await page.getByRole("button", { name: "Analyze" }).click();
    await page.getByRole("button", { name: "1. White: e4" }).click();
    await page.getByLabel("Engine threads").selectOption(String(threads));
    await page.getByRole("button", { name: "Browser Quick review" }).click();
    await expect(
      page.getByRole("status", { name: "Browser analysis progress" }),
    ).toContainText("Screening finished", { timeout: 60000 });
    await expect(page.getByText("1/1 plies available")).toBeVisible();
    const transcript = engineOutput.join("\n");
    await test.info().attach("stockfish-uci", {
      body: transcript,
      contentType: "text/plain",
    });
    expect(transcript).toContain("Stockfish 17.1");
    expect(transcript).toContain("uciok");
    expect(transcript).toMatch(
      /info depth [1-9].*score (cp|mate) -?\d+.*nodes [1-9]\d*.*pv [a-h][1-8][a-h][1-8]/,
    );
    expect(transcript).toMatch(/bestmove [a-h][1-8][a-h][1-8]/);

    await expect(page.getByText("Played-line evaluation")).toBeVisible();
    await page.getByRole("button", { name: "First position" }).click();
    await expect(
      page.getByRole("list", { name: "Engine variations" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "1. White: e4" }).click();
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

test("missing WASM cannot produce completed analysis or evidence", async ({
  page,
}) => {
  let evidenceRequests = 0;
  await fixtureRoutes(page, () => {});
  page.on("request", (request) => {
    if (request.url().endsWith("/browser-evidence")) evidenceRequests++;
  });
  await page.route("**/engine/*.wasm", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/?engine=browser");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("button", { name: "Browser Quick review" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Engine download unavailable",
  );
  await expect(page.getByText("0/1 plies available")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Engine variations" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Browser analysis progress" }),
  ).not.toContainText("Screening finished");
  expect(evidenceRequests).toBe(0);
  expect(page.workers()).toHaveLength(0);
});
