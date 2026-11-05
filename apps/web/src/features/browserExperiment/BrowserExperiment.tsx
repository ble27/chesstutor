import { useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import { PositionEvidence } from "../review/PositionEvidence";
import { useBrowserReview } from "./useBrowserReview";

export function BrowserExperiment({
  game,
  selectedPly,
}: {
  game: Game;
  selectedPly: number;
}) {
  const supportsThreads =
    globalThis.crossOriginIsolated &&
    typeof SharedArrayBuffer !== "undefined" &&
    navigator.hardwareConcurrency >= 4;
  const [threads, setThreads] = useState(supportsThreads ? 2 : 1);
  return (
    <BrowserSession
      key={`${game.game.id}:${game.version}:${game.pgn_hash}:${threads}`}
      game={game}
      selectedPly={selectedPly}
      threads={threads}
      setThreads={setThreads}
      supportsThreads={supportsThreads}
    />
  );
}

function BrowserSession({
  game,
  selectedPly,
  threads,
  setThreads,
  supportsThreads,
}: {
  game: Game;
  selectedPly: number;
  threads: number;
  setThreads: (value: number) => void;
  supportsThreads: boolean;
}) {
  const { values, busy, message, error, run, cancel } = useBrowserReview(
    game,
    threads,
  );
  return (
    <section
      className="panel engine-panel"
      aria-labelledby="browser-engine-title"
    >
      <p className="eyebrow">Branch experiment · this device</p>
      <h2 id="browser-engine-title">Browser engine analysis</h2>
      <p>
        Full Stockfish 17.1 · provisional personal review. Scores are
        client-generated, not server-verified classifications. No server engine
        job is submitted.
      </p>
      <p>
        Quick targets 30,000 nodes per search with a 250ms cap; selected-move
        refinement targets 300,000 nodes with a 1500ms cap. First download is
        approximately 70 MiB; browser caching speeds later starts. Closing this
        tab stops computation.
      </p>
      <label>
        Engine threads{" "}
        <select
          value={threads}
          disabled={busy}
          onChange={(event) => setThreads(Number(event.target.value))}
        >
          <option value={1}>1 · single-thread fallback</option>
          {supportsThreads && <option value={2}>2 · isolated worker</option>}
        </select>
      </label>
      <div className="analysis-actions">
        <button disabled={busy} onClick={() => void run(selectedPly, false)}>
          Browser Quick review
        </button>
        <button
          disabled={busy || selectedPly === 0}
          onClick={() => void run(selectedPly, true)}
        >
          Deepen selected move
        </button>
        {busy && <button onClick={cancel}>Cancel browser analysis</button>}
      </div>
      <p role="status" aria-label="Browser analysis progress">
        {message}
      </p>
      <p>
        {values.length}/{game.positions.length - 1} plies available
      </p>
      <progress
        aria-label="Browser analysed plies"
        value={values.length}
        max={game.positions.length - 1}
      />
      {error && (
        <p role="alert">
          {error} Completed local positions are retained for retry.
        </p>
      )}
      <PositionEvidence
        game={game}
        selectedPly={selectedPly}
        evidence={values}
      />
      <p className="engine-provenance">
        Full WASM 17.1 · Threads {threads} · Hash 128 MiB · browser-policy1 ·
        local unverified evidence.{" "}
        <a href="/engine/LICENSE.txt">GPLv3 license</a> ·{" "}
        <a href="https://github.com/nmrugg/stockfish.js/tree/v17.1.0">
          Exact source/build
        </a>
      </p>
      <a href="?engine=server">Compare existing server analysis</a>
    </section>
  );
}
