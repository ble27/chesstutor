import { request } from "./client";
import { parseArchives, parseGame, parseGames } from "./discoveryValidation";

export type Filters = {
  color: "" | "white" | "black";
  opponent: string;
  time_class: string;
};
export const emptyFilters: Filters = {
  color: "",
  opponent: "",
  time_class: "",
};
export const archives = (username: string, signal: AbortSignal) =>
  request(
    `/api/v1/players/${encodeURIComponent(username.trim())}/archives`,
    parseArchives,
    { signal, timeoutMs: 100000 },
  );
export function games(
  username: string,
  month: string,
  filters: Filters,
  cursor: string | null,
  signal: AbortSignal,
) {
  const [year = "", number = ""] = month.split("-");
  const query = new URLSearchParams({ year, month: number });
  if (filters.color) query.set("color", filters.color);
  if (filters.opponent.trim()) query.set("opponent", filters.opponent.trim());
  if (filters.time_class) query.set("time_class", filters.time_class);
  if (cursor) query.set("cursor", cursor);
  return request(
    `/api/v1/players/${encodeURIComponent(username)}/games?${query}`,
    parseGames,
    { signal, timeoutMs: 100000 },
  );
}
export const openGame = (id: string, signal: AbortSignal) =>
  request(`/api/v1/games/${encodeURIComponent(id)}`, parseGame, {
    signal,
    timeoutMs: 15000,
  });
