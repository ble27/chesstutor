import { request } from "./client";
import type { components } from "./generated";
import { isRecord } from "./validation";

export type Ratings = components["schemas"]["PlayerRatings"];

export function parseRatings(input: unknown): Ratings {
  if (
    !isRecord(input) ||
    typeof input.username !== "string" ||
    !/^[a-z0-9_-]{3,25}$/.test(input.username) ||
    typeof input.stale !== "boolean" ||
    typeof input.fetched_at !== "string" ||
    !Number.isFinite(Date.parse(input.fetched_at))
  )
    throw new Error("Invalid player ratings");
  const rating = (value: unknown): number | null => {
    if (value === null) return null;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > 10000
    )
      throw new Error("Invalid rating");
    return value;
  };
  return {
    username: input.username,
    fetched_at: input.fetched_at,
    stale: input.stale,
    rapid: rating(input.rapid),
    blitz: rating(input.blitz),
    bullet: rating(input.bullet),
  };
}

export const playerRatings = (username: string, signal: AbortSignal) =>
  request(
    `/api/v1/players/${encodeURIComponent(username)}/ratings`,
    parseRatings,
    { signal, timeoutMs: 100000 },
  );
