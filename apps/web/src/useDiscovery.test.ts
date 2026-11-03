import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "./api/client";
import * as api from "./api/discovery";
import { archive, imported, listing } from "./testFixtures/discovery";
import { useDiscovery } from "./useDiscovery";

vi.mock("./api/discovery", async (original) => ({
  ...(await original<typeof api>()),
  archives: vi.fn(),
  games: vi.fn(),
  openGame: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(api.archives).mockReset().mockResolvedValue(archive);
  vi.mocked(api.games).mockReset().mockResolvedValue(listing);
  vi.mocked(api.openGame).mockReset().mockResolvedValue(imported);
});
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Not initialized");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it("defaults to the newest month and resets selection on filters", async () => {
  const { result } = renderHook(useDiscovery);
  await act(() => result.current.search("alice"));
  expect(result.current.month).toBe("2026-11");
  expect(api.games).toHaveBeenCalledWith(
    "alice",
    "2026-11",
    api.emptyFilters,
    null,
    expect.any(AbortSignal),
  );
  await act(() => result.current.open(imported.game.id));
  expect(result.current.game.status).toBe("ready");
  const filters = {
    color: "black" as const,
    opponent: "bobby",
    time_class: "rapid",
  };
  await act(() => result.current.select("2026-10", filters, "cursor"));
  expect(result.current.game.status).toBe("idle");
  expect(api.games).toHaveBeenLastCalledWith(
    "alice",
    "2026-10",
    filters,
    "cursor",
    expect.any(AbortSignal),
  );
});
it("keeps an empty archive distinct from a provider failure", async () => {
  vi.mocked(api.archives).mockResolvedValueOnce({ ...archive, months: [] });
  const { result } = renderHook(useDiscovery);
  await act(() => result.current.search("alice"));
  expect(result.current.archive.status).toBe("ready");
  expect(api.games).not.toHaveBeenCalled();
  vi.mocked(api.archives).mockRejectedValueOnce(
    new ApiError("player_not_found", "Player not found", false, 404),
  );
  await act(() => result.current.search("missing"));
  expect(result.current.archive).toMatchObject({
    status: "error",
    error: { code: "player_not_found" },
  });
});
it("ignores an old archive response after a new search", async () => {
  const old = deferred<typeof archive>();
  vi.mocked(api.archives).mockReturnValueOnce(old.promise);
  const { result } = renderHook(useDiscovery);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.search("old");
  });
  const oldSignal = vi.mocked(api.archives).mock.calls[0]?.[1];
  await act(() => result.current.search("alice"));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => {
    old.resolve({ ...archive, username: "old" });
    await pending;
  });
  expect(result.current.archive).toMatchObject({
    status: "ready",
    data: { username: "alice" },
  });
  expect(api.games).toHaveBeenCalledTimes(1);
});
it("ignores an old monthly response after changing month", async () => {
  const old = deferred<typeof listing>();
  vi.mocked(api.games).mockReturnValueOnce(old.promise);
  const { result } = renderHook(useDiscovery);
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.search("alice");
  });
  await waitFor(() => expect(result.current.archive.status).toBe("ready"));
  await act(() => result.current.select("2026-10", api.emptyFilters));
  await act(async () => {
    old.resolve({ ...listing, stale: true });
    await pending;
  });
  expect(result.current.list).toMatchObject({
    status: "ready",
    data: { stale: false },
  });
  expect(result.current.month).toBe("2026-10");
});
it("ignores a stale import and aborts requests on unmount", async () => {
  const old = deferred<typeof imported>();
  vi.mocked(api.openGame).mockReturnValueOnce(old.promise);
  const { result, unmount } = renderHook(useDiscovery);
  await act(() => result.current.search("alice"));
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.open(imported.game.id);
  });
  const signal = vi.mocked(api.openGame).mock.calls[0]?.[1];
  await act(() => result.current.search("alice"));
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    old.resolve(imported);
    await pending;
  });
  expect(result.current.game.status).toBe("idle");
  const active = vi.mocked(api.archives).mock.calls.at(-1)?.[1];
  unmount();
  expect(active?.aborted).toBe(true);
});
it("retains distinct month and import errors for retry", async () => {
  vi.mocked(api.games).mockRejectedValueOnce(
    new ApiError("month_not_found", "Missing month", false, 404),
  );
  const { result } = renderHook(useDiscovery);
  await act(() => result.current.search("alice"));
  expect(result.current.list).toMatchObject({
    status: "error",
    error: { code: "month_not_found" },
  });
  await act(() => result.current.select("2026-11", api.emptyFilters));
  vi.mocked(api.openGame).mockRejectedValueOnce(
    new ApiError("invalid_pgn", "Invalid PGN", false, 422),
  );
  await act(() => result.current.open(imported.game.id));
  expect(result.current.game).toMatchObject({
    status: "error",
    error: { code: "invalid_pgn" },
  });
});
