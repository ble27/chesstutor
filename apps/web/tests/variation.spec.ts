import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { archive, listing } from "../src/testFixtures/discovery";
import {
  analysisGame,
  positionJob,
} from "../src/testFixtures/positionAnalysis";

async function openReview(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/health/ready"))
      return route.fulfill({ json: { status: "ready" } });
    if (path.endsWith("/archives")) return route.fulfill({ json: archive });
    if (path.includes("/players/"))
      return route.fulfill({
        json: { ...listing, games: [analysisGame.game] },
      });
    if (path.includes("/analyses")) return route.fulfill({ json: positionJob });
    return route.fulfill({ json: analysisGame });
  });
  await page.goto("/");
  await page.getByLabel("Chess.com username").fill("alice");
  await page.getByRole("button", { name: "Find games" }).click();
  await page.getByRole("button", { name: "Analyze" }).click();
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`stored variation and return restore the game at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openReview(page);
    await page.getByRole("button", { name: "Next move" }).click();
    const evaluation = page.locator(".evaluation-rail strong");
    await expect(evaluation).toHaveText("-0.35");
    expect(
      await evaluation.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      }),
    ).toBe(1);
    await page.getByRole("button", { name: "Explore variation 1" }).click();
    await expect(evaluation).toHaveText("—");
    await page.getByRole("button", { name: "Next move" }).click();
    await expect(page.getByLabel("Position FEN")).toHaveText(
      analysisGame.positions[2]?.fen ?? "missing",
    );
    await expect(
      page.getByRole("button", { name: "Next move" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Flip board" }).click();
    await page.getByRole("button", { name: "Return to game" }).click();
    await expect(page.getByLabel("Position FEN")).toHaveText(
      analysisGame.positions[1]?.fen ?? "missing",
    );
    await expect(evaluation).toHaveText("-0.35");
    await expect(
      page.getByRole("button", { name: "Explore variation 1" }),
    ).toBeFocused();
    await expect(
      page.getByRole("img", { name: "Chessboard, Black at bottom" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Report" }).click();
    await expect(
      page.getByRole("button", { name: "1. White: e4" }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 320 || width === 1440)
      await page
        .locator(".workspace")
        .screenshot({ path: `/tmp/chesstutor-s6-variation-${width}.png` });
  });
}

test("engine settings retain touch size and visible keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReview(page);
  const limits = page.getByRole("button", { name: "Engine settings" });
  const bounds = await limits.boundingBox();
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await limits.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(limits).toBeFocused();
  const outline = await limits.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test("review reflows at a 200 percent zoom-equivalent viewport with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReview(page);
  await expect(
    page.getByRole("button", { name: "Explore variation 1" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Explore variation 1" }).click();
  await page.getByRole("button", { name: "Next move" }).click();
  await page.getByRole("button", { name: "Return to game" }).click();
  await expect(
    page.getByRole("button", { name: "Explore variation 1" }),
  ).toBeFocused();
  const motion = await page.locator(".workspace").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animation: style.animationName,
      transition: style.transitionDuration,
      scroll: style.scrollBehavior,
    };
  });
  expect(motion).toEqual({
    animation: "none",
    transition: "0s",
    scroll: "auto",
  });
  await page
    .locator(".workspace")
    .screenshot({ path: "/tmp/chesstutor-s6-zoom.png" });
});

test("review text and enabled controls meet normal-text contrast", async ({
  page,
}) => {
  await openReview(page);
  const ratios = await page
    .locator(".workspace p, .workspace button:enabled, .workspace summary")
    .evaluateAll((elements) => {
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map((part) => {
            const value = Number(part) / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
        return (
          (channels?.[0] ?? 0) * 0.2126 +
          (channels?.[1] ?? 0) * 0.7152 +
          (channels?.[2] ?? 0) * 0.0722
        );
      };
      return elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          let parent: Element | null = element;
          let background = "rgb(36, 36, 36)";
          while (parent) {
            const color = getComputedStyle(parent).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
              background = color;
              break;
            }
            parent = parent.parentElement;
          }
          const foreground = luminance(getComputedStyle(element).color);
          const surface = luminance(background);
          return {
            text: element.textContent,
            ratio:
              (Math.max(foreground, surface) + 0.05) /
              (Math.min(foreground, surface) + 0.05),
          };
        });
    });
  expect(ratios.length).toBeGreaterThan(10);
  for (const item of ratios)
    expect(item.ratio, item.text ?? "text").toBeGreaterThanOrEqual(4.5);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`desktop dashboard keeps board, coach, graph and controls in view at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openReview(page);
    await expect(page.locator(".evaluation-rail strong")).toHaveText("+1.20");
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.getByRole("img", { name: /Chessboard/ })).toBeInViewport({
      ratio: 1,
    });
    await expect(page.locator(".coach-module")).toBeInViewport({ ratio: 1 });
    await expect(page.locator(".evaluation-graph")).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByRole("navigation", { name: "Replay controls" }),
    ).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: test.info().outputPath(`dashboard-${viewport.width}.png`),
    });
  });
}
