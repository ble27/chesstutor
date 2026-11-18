import type { LocalAnalysis } from "./useLocalAnalysis";
import { CheckField } from "../../components/ui/Checkbox";
import { formatWhiteEvaluation } from "../review/reviewPresentation";
import { SandboxPanel } from "./SandboxPanel";

export function LocalAnalysisControls({ local }: { local: LocalAnalysis }) {
  const lines = local.live.lines;
  const depth = lines[0]?.depth;
  return (
    <>
      <section className="panel local-engine" aria-label="Local engine">
        <div className="module-heading">
          <h2>Stockfish 17.1</h2>
          {depth !== undefined && (
            <span className="engine-depth">Depth {depth}</span>
          )}
        </div>
        {lines.length > 0 ? (
          <ol className="engine-lines" aria-label="Local engine variations">
            {lines.map((line) => (
              <li key={line.pv[0]?.uci}>
                <div>
                  <strong className="line-score">
                    {formatWhiteEvaluation(line.score, 2)}
                  </strong>
                  <span>{line.pv.map((step) => step.san).join(" ")}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="engine-status" role="status">
            {local.live.message}
          </p>
        )}
        <CheckField
          label="Engine arrows"
          checked={local.suggestions}
          onChange={local.setSuggestions}
        />
        {local.error && <p role="alert">{local.error}</p>}
        {local.promotion && <Promotion local={local} />}
      </section>
      <section className="panel branch-module">
        <SandboxPanel sandbox={local.sandbox} />
      </section>
    </>
  );
}

const pieceNames: Record<string, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

function Promotion({ local }: { local: LocalAnalysis }) {
  return (
    <div
      role="group"
      aria-label="Choose promotion"
      className="promotion-controls"
    >
      {local.sandbox.position?.legal_moves
        .filter((move) => move.startsWith(local.promotion ?? "!"))
        .map((move) => (
          <button key={move} onClick={() => local.play(move)}>
            Promote to {pieceNames[move[4] ?? ""]}
          </button>
        ))}
      <button onClick={() => local.setPromotion(null)}>Cancel promotion</button>
    </div>
  );
}
