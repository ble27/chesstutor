import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Game } from "../src/api/discoveryValidation";
import { archive, imported, listing } from "../src/testFixtures/discovery";
import { replayFixtures } from "../src/testFixtures/replay";

async function openFixture(page: Page, game: Game = imported) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (url.pathname.endsWith("/archives"))
      return route.fulfill({ json: archive });
    if (url.pathname.includes("/players/"))
      return route.fulfill({ json: { ...listing, games: [game.game] } });
    return route.fulfill({ json: game });
  });
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Open game" }).click();
}

test("opens an imported game for synchronized replay", async ({ page }) => {
  await openFixture(page);
  const board = page.getByRole("img", { name: "Chessboard, White at bottom" });
  await expect(board).toBeVisible();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(
    board.locator('[data-square="e4"] [data-piece="wP"]'),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "1. White: e4" }),
  ).toHaveAttribute("aria-current", "step");
});

for (const { width, height } of [
  { width: 1440, height: 900 },
  { width: 1920, height: 600 },
  { width: 1920, height: 720 },
  { width: 2560, height: 1080 },
  { width: 3440, height: 1440 },
]) {
  test(`caps a wide-screen board and keeps controls visible at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openFixture(page);
    await page
      .getByRole("region", { name: "Game replay" })
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    const board = page.getByRole("img", { name: /Chessboard/ });
    const size = await board.boundingBox();
    if (!size) throw new Error("Missing board");
    expect(size.width).toBeLessThanOrEqual(640);
    expect(size.height).toBeLessThanOrEqual(height - 300);
    expect(Math.abs(size.width - size.height)).toBeLessThan(1);
    await expect(board).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("navigation", { name: "Replay controls" }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 2560 || height === 600) {
      await page.screenshot({
        path: `/tmp/chesstutor-layout-${width}x${height}.png`,
      });
    }
  });
}

test("puts recorded moves beside the board and distinguishes them from engine analysis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  const insights = page.getByRole("complementary", { name: "Game insights" });
  const review = page.getByRole("region", { name: "Game review" });
  const engineBox = await review
    .getByRole("heading", { name: "Engine analysis" })
    .boundingBox();
  const movesBox = await review
    .getByRole("heading", { name: "Game moves" })
    .boundingBox();
  if (!engineBox || !movesBox) throw new Error("Missing review headings");
  expect(engineBox.y).toBeLessThan(movesBox.y);
  await expect(
    insights.getByRole("heading", { name: "Game moves" }),
  ).toBeVisible();
  await expect(
    insights.getByRole("heading", { name: "Engine analysis" }),
  ).toBeVisible();
  await expect(
    insights.getByRole("button", { name: "Quick review" }),
  ).toBeVisible();
  const board = await page
    .getByRole("img", { name: /Chessboard/ })
    .boundingBox();
  const moves = await page
    .getByRole("list", { name: "Game moves" })
    .boundingBox();
  if (!board || !moves) throw new Error("Missing board or move list");
  expect(moves.x).toBeGreaterThanOrEqual(board.x + board.width);
  expect(moves.y).toBeLessThan(board.y + board.height);
  await insights.getByRole("button", { name: "1. White: e4" }).click();
  await expect(
    page
      .getByRole("img", { name: /Chessboard/ })
      .locator('[data-square="e4"] [data-piece="wP"]'),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("status", { name: "Replay position" }),
  ).toContainText("Starting position");
});

test("keeps selected moves visible inside a scrollable move list", async ({
  page,
}) => {
  const fixture = replayFixtures.find((fixture) => fixture.name === "opening");
  if (!fixture) throw new Error("Missing opening fixture");
  await openFixture(page, fixture.game);
  await page.getByRole("button", { name: "Last position" }).click();
  const moves = page.getByRole("list", { name: "Game moves" });
  const selected = page.getByRole("button", { name: "10... Black: Nbd7" });
  await expect(selected).toHaveAttribute("aria-current", "step");
  const listBounds = await moves.boundingBox();
  const moveBounds = await selected.boundingBox();
  expect(listBounds).not.toBeNull();
  expect(moveBounds).not.toBeNull();
  expect((moveBounds?.y ?? 0) + (moveBounds?.height ?? 0)).toBeLessThanOrEqual(
    (listBounds?.y ?? 0) + (listBounds?.height ?? 0),
  );
  await page.getByRole("button", { name: "First position" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(
    page.getByRole("button", { name: "1. White: e4" }),
  ).toBeInViewport();
});

async function renderedPlacement(page: Page): Promise<string> {
  return page.getByRole("img", { name: /Chessboard/ }).evaluate((board) => {
    const ranks: string[] = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = "";
      let empty = 0;
      for (const file of "abcdefgh") {
        const type = board
          .querySelector(`[data-square="${file}${rank}"] [data-piece]`)
          ?.getAttribute("data-piece");
        if (!type) {
          empty++;
          continue;
        }
        if (empty) {
          row += empty;
          empty = 0;
        }
        const piece = type.slice(1);
        row += type.startsWith("w") ? piece : piece.toLowerCase();
      }
      ranks.push(row + (empty || ""));
    }
    return ranks.join("/");
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`exact fixture replay forward/backward and no overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const fixture of replayFixtures) {
      await openFixture(page, fixture.game);
      await page.getByText("Text position and FEN").click();
      for (const position of fixture.game.positions) {
        if (position.ply > 0)
          await page.getByRole("button", { name: "Next move" }).click();
        await expect(page.getByLabel("Position FEN")).toHaveText(position.fen);
        await expect
          .poll(() => renderedPlacement(page))
          .toBe(position.fen.split(" ")[0]);
      }
      for (const position of fixture.game.positions.slice(0, -1).reverse()) {
        await page.getByRole("button", { name: "Previous move" }).click();
        await expect(page.getByLabel("Position FEN")).toHaveText(position.fen);
        await expect
          .poll(() => renderedPlacement(page))
          .toBe(position.fen.split(" ")[0]);
      }
      const board = page.getByRole("img", { name: /Chessboard/ });
      const size = await board.boundingBox();
      expect(size).not.toBeNull();
      expect(Math.abs((size?.width ?? 0) - (size?.height ?? 1))).toBeLessThan(
        1,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.unrouteAll({ behavior: "wait" });
    }
    if (width === 390 || width === 1440) {
      await page.getByText("Text position and FEN").click();
      await page
        .locator(".workspace")
        .screenshot({ path: `/tmp/chesstutor-s2-${width}.png` });
    }
  });
}

test("keyboard navigation stays in replay and flip preserves the selected move", async ({
  page,
}) => {
  await openFixture(page);
  const region = page.getByRole("region", { name: "Game replay" });
  await region.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Next move" })).toBeFocused();
  await region.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("button", { name: "Previous move" }),
  ).toBeDisabled();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Next move" })).toBeDisabled();
  const input = page.getByLabel("Chess.com username");
  await input.focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("button", { name: "Next move" })).toBeDisabled();
  await page.getByRole("button", { name: "Flip board" }).click();
  const board = page.getByRole("img", { name: "Chessboard, Black at bottom" });
  await expect(board.locator("[data-square]").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await expect(
    page.getByRole("button", { name: "1. White: e4" }),
  ).toHaveAttribute("aria-current", "step");
  await region.focus();
  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "1. White: e4" }).click();
  await expect(
    page.getByRole("status", { name: "Replay position" }),
  ).toContainText("After 1. White: e4");
});

for (const [name, game] of [
  [
    "malformed FEN",
    {
      ...imported,
      positions: imported.positions.map((position) =>
        position.ply ? { ...position, fen: "not a FEN" } : position,
      ),
    },
  ],
  [
    "missing UCI",
    {
      ...imported,
      positions: imported.positions.map((position) =>
        position.ply ? { ...position, uci: null } : position,
      ),
    },
  ],
] as const) {
  test(`rejects ${name} at the replay network boundary`, async ({ page }) => {
    await openFixture(page, game);
    await expect(page.getByRole("alert")).toHaveText(
      "The service returned unexpected data.",
    );
    await expect(page.getByRole("img", { name: /Chessboard/ })).toHaveCount(0);
  });
}

for (const width of [320, 390, 768]) {
  test(`stacks moves below replay without clipping long player names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const game: Game = {
      ...imported,
      game: {
        ...imported.game,
        white: { ...imported.game.white, username: "White_".repeat(16) },
        black: { ...imported.game.black, username: "Black_".repeat(16) },
      },
    };
    await openFixture(page, game);
    const board = await page
      .getByRole("img", { name: /Chessboard/ })
      .boundingBox();
    const moves = await page
      .getByRole("list", { name: "Game moves" })
      .boundingBox();
    if (!board || !moves) throw new Error("Missing board or moves");
    expect(moves.y).toBeGreaterThan(board.y + board.height);
    await expect(page.getByRole("group", { name: "Top player" })).toContainText(
      game.game.black.username,
    );
    await expect(
      page.getByRole("group", { name: "Bottom player" }),
    ).toContainText(game.game.white.username);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("flips visible player names together with the pieces and preserves the move", async ({
  page,
}) => {
  await openFixture(page);
  const top = page.getByRole("group", { name: "Top player" });
  const bottom = page.getByRole("group", { name: "Bottom player" });
  const board = page.getByRole("img", { name: /Chessboard/ });
  const topBounds = await top.boundingBox();
  const bottomBounds = await bottom.boundingBox();
  const boardBounds = await board.boundingBox();
  if (!topBounds || !bottomBounds || !boardBounds)
    throw new Error("Missing board labels");
  expect(topBounds.y + topBounds.height).toBeLessThanOrEqual(boardBounds.y);
  expect(bottomBounds.y).toBeGreaterThanOrEqual(
    boardBounds.y + boardBounds.height,
  );
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Flip board" }).click();
  await expect(top).toContainText("alice");
  await expect(top).toContainText("White pieces");
  await expect(bottom).toContainText("bobby");
  await expect(bottom).toContainText("Black pieces");
  await expect(board).toHaveAccessibleDescription(
    /alice.*White pieces.*bobby.*Black pieces/,
  );
  await expect(board.locator("[data-square]").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await expect(
    page.getByRole("button", { name: "1. White: e4" }),
  ).toHaveAttribute("aria-current", "step");
});
