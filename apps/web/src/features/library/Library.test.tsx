import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { summary, imported } from "../../testFixtures/discovery";
import { GameRow } from "./GameRow";
import { PlayerRatings } from "./PlayerRatings";
import { LibraryFilters } from "./LibraryFilters";
import { emptyFilters } from "../../api/discovery";

it("shows current stats without substituting archive ratings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        username: "alice",
        rapid: 1512,
        blitz: 1324,
        bullet: null,
        fetched_at: "2026-11-09T12:00:00Z",
        stale: false,
      }),
    ),
  );
  render(<PlayerRatings username="alice" />);
  expect(await screen.findByText("1512")).toBeVisible();
  expect(screen.getByText("1324")).toBeVisible();
  expect(screen.getByText("Unrated")).toBeVisible();
  expect(screen.queryByText("1200")).not.toBeInTheDocument();
});

it("keeps ratings failure separate from game discovery and can retry", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(
      Response.json({
        username: "alice",
        rapid: 1512,
        blitz: null,
        bullet: null,
        fetched_at: "2026-11-09T12:00:00Z",
        stale: true,
      }),
    );
  vi.stubGlobal("fetch", fetch);
  render(<PlayerRatings username="alice" />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry ratings" }));
  expect(await screen.findByText("1512")).toBeVisible();
  expect(screen.getByText(/Cached ratings/)).toBeVisible();
});

it("keeps result, validated move count, and opening in one row", () => {
  const open = vi.fn();
  const { rerender } = render(
    <ul>
      <GameRow game={summary} opened={null} open={open} />
    </ul>,
  );
  expect(screen.getByText("1–0")).toBeVisible();
  expect(screen.getByText("Move count unavailable")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
  expect(open).toHaveBeenCalledWith(summary.id);
  rerender(
    <ul>
      <GameRow game={summary} opened={imported} open={open} />
    </ul>,
  );
  expect(screen.getByText("1 move")).toBeVisible();
  expect(screen.getByRole("button", { name: "Analyze" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

it("preserves advanced filters when changing time control", () => {
  const apply = vi.fn();
  render(
    <LibraryFilters
      month="2026-11"
      months={["2026-11"]}
      filters={{ ...emptyFilters, opponent: "bobby", color: "black" }}
      apply={apply}
    />,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "Time control" }));
  fireEvent.click(screen.getByRole("option", { name: "Blitz" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(apply).toHaveBeenCalledWith("2026-11", {
    opponent: "bobby",
    color: "black",
    time_class: "blitz",
  });
});

it("does not offer replay for an unsupported game", () => {
  render(
    <ul>
      <GameRow
        game={{ ...summary, eligibility: "unsupported_game" }}
        opened={null}
        open={vi.fn()}
      />
    </ul>,
  );
  expect(screen.getByText("Unsupported variant")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
