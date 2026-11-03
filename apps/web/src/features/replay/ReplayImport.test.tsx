import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Game } from "../../api/discoveryValidation";
import { Discovery } from "../../Discovery";
import { archive, imported, listing } from "../../testFixtures/discovery";
import { replayFixtures } from "../../testFixtures/replay";

async function importResponse(payload: unknown) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(archive))
      .mockResolvedValueOnce(Response.json(listing))
      .mockResolvedValueOnce(Response.json(payload)),
  );
  render(<Discovery />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Chess.com username" }),
    { target: { value: "alice" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Find games" }));
  fireEvent.click(await screen.findByRole("button", { name: "Open game" }));
}

function changedPosition(
  changes: Partial<Game["positions"][number]>,
  ply = 1,
): Game {
  return {
    ...imported,
    positions: imported.positions.map((position) =>
      position.ply === ply ? { ...position, ...changes } : position,
    ),
  };
}

it.each([
  "8/8/8/8/8/8/8 w - - 0 1",
  "8/8/8/8/8/8/8/7 w - - 0 1",
  "8/8/8/8/8/8/8/81 w - - 0 1",
  "8/8/8/8/8/8/8/X7 w - - 0 1",
  "8/8/8/8/8/8/8/8 x - - 0 1",
  "8/8/8/8/8/8/8/8 w KK - 0 1",
  "8/8/8/8/8/8/8/8 w QK - 0 1",
  "8/8/8/8/8/8/8/8 w - e4 0 1",
  "8/8/8/8/8/8/8/8 w - - -1 1",
  "8/8/8/8/8/8/8/8 w - - 0.5 1",
  "8/8/8/8/8/8/8/8 w - - 9007199254740992 1",
  "8/8/8/8/8/8/8/8 w - - 0 0",
  "8/8/8/8/8/8/8/8 w - - 0 9007199254740992",
  "8/8/8/8/8/8/8/8 w - - 0 1 extra",
])(
  "explains invalid display FEN instead of opening replay: %s",
  async (fen) => {
    await importResponse(changedPosition({ fen }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The service returned unexpected data.",
    );
    expect(
      screen.queryByRole("region", { name: "Game replay" }),
    ).not.toBeInTheDocument();
  },
);

it.each([
  { name: "initial SAN", payload: changedPosition({ san: "e4" }, 0) },
  { name: "initial UCI", payload: changedPosition({ uci: "e2e4" }, 0) },
  { name: "missing SAN", payload: changedPosition({ san: null }) },
  { name: "empty SAN", payload: changedPosition({ san: "" }) },
  { name: "oversized SAN", payload: changedPosition({ san: "x".repeat(33) }) },
  { name: "missing UCI", payload: changedPosition({ uci: null }) },
  { name: "invalid square", payload: changedPosition({ uci: "e2e9" }) },
  { name: "invalid promotion", payload: changedPosition({ uci: "e7e8k" }) },
])(
  "explains invalid move metadata instead of opening replay: $name",
  async ({ payload }) => {
    await importResponse(payload);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The service returned unexpected data.",
    );
    expect(
      screen.queryByRole("region", { name: "Game replay" }),
    ).not.toBeInTheDocument();
  },
);

it.each(replayFixtures)(
  "opens valid $name positions through the import boundary",
  async ({ game }) => {
    await importResponse(game);
    expect(
      await screen.findByRole("region", { name: "Game replay" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Last position" }));
    expect(screen.getByLabelText("Position FEN")).toHaveTextContent(
      game.positions.at(-1)?.fen ?? "Missing fixture",
    );
  },
);
