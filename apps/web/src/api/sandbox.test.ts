import { expect, it, vi } from "vitest";
import { sandboxPosition } from "./sandbox";
import { imported } from "../testFixtures/discovery";
const initial = {
  trust: "client_unverified",
  fen: imported.initial_fen,
  initial_fen: imported.initial_fen,
  moves: [],
  positions: [],
  legal_moves: ["e2e4"],
  result: null,
  claimable_draw: false,
  line: null,
};
it("accepts canonical initial context and rejects a response for another position", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(initial))
      .mockResolvedValueOnce(
        Response.json({ ...initial, fen: imported.positions[1]?.fen }),
      ),
  );
  await expect(
    sandboxPosition(imported, 0, [], new AbortController().signal),
  ).resolves.toEqual(initial);
  await expect(
    sandboxPosition(imported, 0, [], new AbortController().signal),
  ).rejects.toThrow(/unexpected data/);
});
it("requires exact canonical history rather than trusting the FEN alone", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ...initial, moves: ["d2d4"] })),
  );
  await expect(
    sandboxPosition(imported, 0, [], new AbortController().signal),
  ).rejects.toThrow(/unexpected data/);
});
