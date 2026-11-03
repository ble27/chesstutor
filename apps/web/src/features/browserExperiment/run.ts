import type { Game } from "../../api/discoveryValidation";
import manifest from "../../../../../engines/stockfish-browser.json";
import type { Evidence } from "../../api/analysisEvidence";
import { cachedPositions, clearCachedPositions, savePosition } from "./cache";
import { ApiError } from "../../api/client";
import { BrowserEngine, openBrowserEngine } from "./engine";
import { validatePositions } from "../../api/browserEvidence";

export type Updates = {
  message: (message: string) => void;
  evidence: (values: Evidence[]) => void;
};

async function publishBatch(
  game: Game,
  positions: unknown[],
  key: string,
  signal: AbortSignal,
  updates: Updates,
) {
  try {
    const values = await validatePositions(game, positions, signal);
    let stored = true;
    for (const raw of positions)
      stored = (await savePosition(key, raw)) && stored;
    updates.evidence(values);
    return stored;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_evidence")
      await clearCachedPositions(key);
    throw error;
  }
}

export async function runBrowserReview(
  game: Game,
  selected: number,
  threads: number,
  refine: boolean,
  signal: AbortSignal,
  updates: Updates,
) {
  const nodes = refine ? 300000 : 30000;
  const key = `browser-${manifest.artifact_id}-policy1-${threads}-128-${nodes}-${game.game.id}-${game.version}-${game.pgn_hash}`;
  const cached = await cachedPositions(key);
  const all = game.positions.slice(1).map((position) => position.ply);
  const order = refine
    ? [selected]
    : [selected, ...all.filter((ply) => ply !== selected)];
  let engine: BrowserEngine | null = null;
  let pending: unknown[] = [];
  let storageAvailable = true;
  const started = performance.now();
  try {
    for (const ply of order) {
      signal.throwIfAborted();
      if (!all.includes(ply)) continue;
      const stored = cached.get(ply);
      if (stored !== undefined) pending.push(stored);
      else {
        if (!engine)
          engine = await openBrowserEngine(threads, signal, updates.message);
        updates.message(
          `${refine ? "Refining" : "Reviewing"} move ply ${ply} · ${nodes.toLocaleString()} nodes/search`,
        );
        const best = await engine.search(game, ply, nodes, false, signal);
        const played =
          best.pv[0] === game.positions[ply]?.uci
            ? best
            : await engine.search(game, ply, nodes, true, signal);
        const raw = { ply, best, played };
        pending.push(raw);
      }
      if (pending.length >= 4 || ply === selected) {
        storageAvailable =
          (await publishBatch(game, pending, key, signal, updates)) &&
          storageAvailable;
        pending = [];
      }
    }
    if (pending.length)
      storageAvailable =
        (await publishBatch(game, pending, key, signal, updates)) &&
        storageAvailable;
    updates.message(
      `${refine ? "Selected move refinement" : "Screening"} finished in ${((performance.now() - started) / 1000).toFixed(1)}s. Provisional client results.${storageAvailable ? "" : " Local storage unavailable; resume is disabled."}`,
    );
  } finally {
    engine?.close();
  }
}
