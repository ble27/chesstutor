import { expect, it, vi } from "vitest";
import { archives, emptyFilters, games, openGame } from "./discovery";
import { parseArchives, parseGame, parseGames } from "./discoveryValidation";
import { archive, imported, listing, summary } from "../testFixtures/discovery";

it("validates all discovery payloads at the network boundary", () => {
  expect(parseArchives(archive)).toEqual(archive);
  expect(parseGames(listing)).toEqual(listing);
  expect(parseGame(imported)).toEqual(imported);
});
it.each([
  null,
  {},
  { ...archive, months: ["2026-13"] },
  { ...archive, stale: "yes" },
  { ...archive, fetched_at: "bad" },
])("rejects invalid archives %j", (value) => {
  expect(() => parseArchives(value)).toThrow();
});
it.each([
  { ...listing, games: [{}] },
  { ...listing, games: [{ ...summary, source_url: "javascript:alert(1)" }] },
  { ...listing, games: [{ ...summary, eligibility: "maybe" }] },
  {
    ...listing,
    games: [{ ...summary, white: { username: "alice", rating: -1 } }],
  },
  { ...listing, next_cursor: 1 },
])("rejects invalid metadata %j", (value) => {
  expect(() => parseGames(value)).toThrow();
});
it.each([
  { ...imported, result: "*" },
  { ...imported, positions: [] },
  { ...imported, positions: [{ ...imported.positions[0], ply: 5 }] },
  { ...imported, pgn_hash: "bad" },
])("rejects invalid imported games %j", (value) => {
  expect(() => parseGame(value)).toThrow();
});
it("encodes usernames and filters without accepting arbitrary paths", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(archive))
    .mockResolvedValueOnce(Response.json(listing))
    .mockResolvedValueOnce(Response.json(imported));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await archives(" Alice ", signal);
  await games(
    "alice",
    "2026-11",
    { ...emptyFilters, opponent: "a&cursor=x", color: "black" },
    "cursor",
    signal,
  );
  await openGame(summary.id, signal);
  expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/players/Alice/archives");
  const url = new URL(String(fetcher.mock.calls[1]?.[0]), "http://test");
  expect(url.searchParams.get("opponent")).toBe("a&cursor=x");
  expect(url.searchParams.get("cursor")).toBe("cursor");
});
it("keeps older summaries usable without fabricating result or move count", () => {
  const legacy = Object.fromEntries(
    Object.entries(summary).filter(
      ([key]) => key !== "result" && key !== "move_count",
    ),
  );
  expect(parseGames({ ...listing, games: [legacy] }).games[0]).toMatchObject({
    result: null,
    move_count: null,
  });
});
it.each([
  { move_count: -1 },
  { move_count: 152 },
  { move_count: 1.5 },
  { result: "*" },
])("rejects invalid summary evidence %j", (change) => {
  expect(() =>
    parseGames({ ...listing, games: [{ ...summary, ...change }] }),
  ).toThrow();
});
