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
