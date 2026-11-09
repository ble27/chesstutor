import { expect, it } from "vitest";
import { parseRatings } from "./ratings";
const stats = {
  username: "alice",
  rapid: 1512,
  blitz: null,
  bullet: 1324,
  fetched_at: "2026-11-09T12:00:00Z",
  stale: false,
};
it("validates stats including unrated time controls", () => {
  expect(parseRatings(stats)).toEqual(stats);
});
it.each([-1, 10001, true, "1200", 1.5, undefined])(
  "rejects invalid rating %s",
  (rapid) => {
    expect(() => parseRatings({ ...stats, rapid })).toThrow();
  },
);
