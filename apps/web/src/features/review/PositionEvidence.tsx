import { useEffect, useRef } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";
import { positionAnalysis } from "./positionAnalysis";
import { formatScore } from "./EngineEvidence";

export function PositionEvidence({
  game,
  selectedPly,
  evidence,
}: {
  game: Game;
  selectedPly: number;
  evidence: readonly Evidence[];
}) {
  const view = positionAnalysis(game, selectedPly, evidence);
  const content = useRef<HTMLDivElement>(null);
  const scoreKey = JSON.stringify(view?.score);
  useEffect(() => {
    // Reveal changed position evidence without scrolling the page or board.
    const region = content.current?.closest(".analysis-region");
    if (region) region.scrollTop = 0;
  }, [selectedPly, scoreKey]);
  if (!view)
    return <p role="status">Engine evidence for this position is pending.</p>;
  return (
    <div className="position-evidence" ref={content}>
      <p className="position-score" aria-live="polite" aria-atomic="true">
        <strong>{formatScore(view.score, 2)}</strong>
        <span>
          White evaluation ·{" "}
          {view.kind === "position"
            ? "current position"
            : `after ${game.positions[selectedPly]?.san}`}
        </span>
      </p>
      {view.status !== "usable" && (
        <p>Evidence is {view.status}; treat this evaluation as uncertain.</p>
      )}
      {view.claimableDraw && <p>A draw is claimable in this position.</p>}
      {view.result && (
        <p>
          Automatic result: {view.result}
          {view.reason && ` (${view.reason})`}.
        </p>
      )}
      {view.lines.length > 0 ? (
        <ol className="candidate-lines" aria-label="Engine variations">
          {view.lines.map((line, index) => (
            <li key={index}>
              <strong>{formatScore(line.score, 2)}</strong>
              <span>{line.pv.map((move) => move.san).join(" ")}</span>
              <small>Depth {line.depth}</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          Current-position variations are unavailable. Showing the engine's
          played-line evaluation.
        </p>
      )}
    </div>
  );
}
