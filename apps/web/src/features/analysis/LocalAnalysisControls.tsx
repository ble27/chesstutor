import type { LocalAnalysis } from "./useLocalAnalysis";
import { SandboxPanel } from "./SandboxPanel";
export function LocalAnalysisControls({
  local,
  selectedPly,
  leaveVariation,
}: {
  local: LocalAnalysis;
  selectedPly: number;
  leaveVariation: () => void;
}) {
  return (
    <section aria-label="Local analysis" className="local-analysis">
      <label>
        <input
          type="checkbox"
          checked={local.sandbox.enabled}
          onChange={(event) => {
            leaveVariation();
            local.setRefine(false);
            if (event.target.checked) local.sandbox.begin(selectedPly);
            else local.sandbox.exit();
          }}
        />
        Self-analysis / Free play
      </label>
      {!local.sandbox.enabled && (
        <label>
          <input
            type="checkbox"
            checked={local.refine}
            onChange={(event) => {
              leaveVariation();
              if (event.target.checked) local.startRefine(selectedPly);
              else local.setRefine(false);
            }}
          />
          Refine this position locally
        </label>
      )}
      {(local.refine || local.sandbox.enabled) && (
        <>
          <label>
            <input
              type="checkbox"
              checked={local.suggestions}
              onChange={(event) => local.setSuggestions(event.target.checked)}
            />
            Local suggestion arrows
          </label>
          <p role="status">{local.live.message} · Client-unverified</p>
          {local.error && <p role="alert">{local.error}</p>}
        </>
      )}
      {local.sandbox.enabled && <SandboxPanel sandbox={local.sandbox} />}
      {local.promotion && (
        <div role="group" aria-label="Choose promotion">
          {local.sandbox.position?.legal_moves
            .filter((move) => move.startsWith(local.promotion ?? "!"))
            .map((move) => (
              <button key={move} onClick={() => local.play(move)}>
                Promote to{" "}
                {move.endsWith("q")
                  ? "queen"
                  : move.endsWith("r")
                    ? "rook"
                    : move.endsWith("b")
                      ? "bishop"
                      : "knight"}
              </button>
            ))}
          <button onClick={() => local.setPromotion(null)}>
            Cancel promotion
          </button>
        </div>
      )}
    </section>
  );
}
