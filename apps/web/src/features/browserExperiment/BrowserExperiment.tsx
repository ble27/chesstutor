import { SelectField } from "../../components/ui/Select";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import { EngineDepth, EngineLines } from "../review/WorkspaceEngine";
import { positionAnalysis } from "../review/positionAnalysis";
import type { PositionAnalysis } from "../review/positionAnalysis";

type BrowserProps = {
  game: Game;
  selectedPly: number;
  workspace?: (
    engine: ReactNode,
    position: PositionAnalysis | null,
  ) => ReactNode;
};
import { useBrowserReview } from "./useBrowserReview";

export function BrowserExperiment({
  game,
  selectedPly,
  workspace,
}: BrowserProps) {
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
      {...(workspace ? { workspace } : {})}
    />
  );
}

function BrowserSession({
  game,
  selectedPly,
  threads,
  setThreads,
  supportsThreads,
  workspace,
}: BrowserProps & {
  threads: number;
  setThreads: (value: number) => void;
  supportsThreads: boolean;
}) {
  const { values, busy, message, error, run, cancel } = useBrowserReview(
    game,
    threads,
  );
  const position = positionAnalysis(game, selectedPly, values);
  const engine = (
    <section className="engine-panel" aria-labelledby="browser-engine-title">
      <div className="module-heading">
        <h2 id="browser-engine-title">Browser engine analysis</h2>
        <EngineDepth position={position} />
      </div>
      <p className="engine-status">Stockfish 17.1 · Provisional</p>
      <SelectField
        label="Engine threads"
        value={String(threads)}
        disabled={busy}
        onChange={(value) => setThreads(Number(value))}
        options={
          supportsThreads
            ? [
                { value: "1", label: "1" },
                { value: "2", label: "2" },
              ]
            : [{ value: "1", label: "1" }]
        }
      />
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
      <p className="engine-status">
        {values.length}/{game.positions.length - 1} plies available
      </p>
      {error && <p role="alert">{error}</p>}
      <EngineLines
        game={game}
        ply={selectedPly}
        position={position}
        showPrimaryScore={!workspace}
      />
      <p className="engine-provenance">
        <a href="/engine/LICENSE.txt">GPLv3 license</a> ·{" "}
        <a href="https://github.com/nmrugg/stockfish.js/tree/v17.1.0">
          Exact source/build
        </a>
      </p>
      <a href="?engine=server">Compare existing server analysis</a>
    </section>
  );
  return workspace ? workspace(engine, position) : engine;
}
