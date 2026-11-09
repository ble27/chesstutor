import type { components } from "./generated";
import { isRecord } from "./validation";
import { positionFen, validateMove } from "./replayValidation";

type Schemas = components["schemas"];
export type Archives = Schemas["ArchivesResponse"];
export type Games = Schemas["GamesResponse"];
export type Game = Schemas["GameResponse"];
export type Summary = Schemas["GameSummary"];

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected object");
  return value;
}
function text(value: unknown, max = 300): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Expected bounded text");
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid date");
  return result;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("Invalid integer");
  return value;
}
function freshness(value: Record<string, unknown>) {
  if (typeof value.stale !== "boolean") throw new Error("Invalid freshness");
  return { stale: value.stale, fetched_at: date(value.fetched_at) };
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid array");
  return value;
}
export function parseArchives(input: unknown): Archives {
  const value = record(input);
  const months = array(value.months, 1200).map((month) => {
    const result = text(month);
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(result))
      throw new Error("Invalid month");
    return result;
  });
  return { ...freshness(value), username: text(value.username, 25), months };
}
function player(input: unknown): Schemas["Player"] {
  const value = record(input);
  return {
    username: text(value.username, 100),
    rating: value.rating == null ? null : integer(value.rating, 0, 10000),
    result: value.result == null ? null : text(value.result, 100),
  };
}
export function parseSummary(input: unknown): Summary {
  const value = record(input);
  const eligibility = value.eligibility;
  if (
    eligibility !== "available" &&
    eligibility !== "unsupported_game" &&
    eligibility !== "unfinished_game" &&
    eligibility !== "invalid_data" &&
    eligibility !== "game_too_large"
  )
    throw new Error("Invalid eligibility");
  const source = text(value.source_url, 200);
  if (!/^https:\/\/www\.chess\.com\/game\/(live|daily)\/\d{1,24}$/.test(source))
    throw new Error("Unsafe source");
  const id = text(value.id, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  )
    throw new Error("Invalid ID");
  const result = value.result;
  if (
    result != null &&
    result !== "1-0" &&
    result !== "0-1" &&
    result !== "1/2-1/2"
  )
    throw new Error("Invalid summary result");
  return {
    id,
    result: result ?? null,
    source_url: source,
    white: player(value.white),
    black: player(value.black),
    end_time: value.end_time === null ? null : date(value.end_time),
    time_class: nullableText(value.time_class),
    rules: text(value.rules, 100),
    move_count:
      value.move_count == null ? null : integer(value.move_count, 1, 151),
    eligibility,
  };
}
export function parseGames(input: unknown): Games {
  const value = record(input);
  return {
    ...freshness(value),
    games: array(value.games, 20).map(parseSummary),
    next_cursor:
      value.next_cursor === null ? null : text(value.next_cursor, 200),
  };
}
export function parseGame(input: unknown): Game {
  const value = record(input);
  const result = value.result;
  if (result !== "1-0" && result !== "0-1" && result !== "1/2-1/2")
    throw new Error("Invalid result");
  const positions = array(value.positions, 301).map((input, index) => {
    const position = record(input);
    const ply = integer(position.ply, index, index);
    const san = nullableText(position.san);
    const uci = nullableText(position.uci);
    validateMove(ply, san, uci);
    return {
      ply,
      fen: positionFen(text(position.fen, 200)),
      san,
      uci,
    };
  });
  if (positions.length < 2 || positions[0]?.fen !== value.initial_fen)
    throw new Error("Invalid positions");
  const hash = text(value.pgn_hash, 64);
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("Invalid hash");
  return {
    game: parseSummary(value.game),
    version: integer(value.version, 1, Number.MAX_SAFE_INTEGER),
    result,
    pgn_hash: hash,
    initial_fen: text(value.initial_fen, 200),
    positions,
  };
}
