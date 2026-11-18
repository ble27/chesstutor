import type { components } from "../../api/generated";
export type RawLine = components["schemas"]["BrowserLine"];
export type RawPly = components["schemas"]["BrowserPly"];

export function parseInfo(message: string): RawLine | null {
  const tokens = message.trim().split(/\s+/);
  const number = (key: string) => {
    const index = tokens.indexOf(key);
    return index < 0 ? NaN : Number(tokens[index + 1]);
  };
  const depth = number("depth"),
    nodes = number("nodes"),
    time = number("time");
  const scoreIndex = tokens.indexOf("score"),
    pvIndex = tokens.indexOf("pv");
  const kind = tokens[scoreIndex + 1],
    value = Number(tokens[scoreIndex + 2]);
  if (
    tokens[0] !== "info" ||
    scoreIndex < 0 ||
    pvIndex < 0 ||
    (kind !== "cp" && kind !== "mate") ||
    !Number.isSafeInteger(value) ||
    !Number.isSafeInteger(depth) ||
    depth < 1 ||
    !Number.isSafeInteger(nodes) ||
    nodes < 1 ||
    !Number.isSafeInteger(time) ||
    time < 0
  )
    return null;
  const pv = tokens.slice(pvIndex + 1, pvIndex + 65);
  if (
    !pv.length ||
    pv.some((move) => !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
  )
    return null;
  const wdlIndex = tokens.indexOf("wdl");
  let wdl: number[] | null = null;
  if (wdlIndex >= 0) {
    wdl = tokens.slice(wdlIndex + 1, wdlIndex + 4).map(Number);
    if (
      wdl.length !== 3 ||
      wdl.some((n) => !Number.isInteger(n) || n < 0) ||
      wdl.reduce((a, b) => a + b, 0) !== 1000
    )
      return null;
  }
  return {
    score: { kind, value },
    wdl,
    depth,
    nodes,
    time_ms: time,
    pv,
    bounded: tokens.includes("lowerbound") || tokens.includes("upperbound"),
  };
}

export function rankedLine(
  message: string,
): { rank: 1 | 2; line: RawLine } | null {
  const line = parseInfo(message);
  const rank = Number(message.match(/\bmultipv (\d+)/)?.[1] ?? "1");
  return line && !line.bounded && (rank === 1 || rank === 2)
    ? { rank, line }
    : null;
}
