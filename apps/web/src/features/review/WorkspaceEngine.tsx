import type { Game } from "../../api/discoveryValidation";
import { active } from "../../api/analysis";
import type { PositionAnalysis } from "./positionAnalysis";
import type { useAnalysis } from "./useAnalysis";
import type { VariationLine } from "./useVariation";
import { reviewPresentation } from "./reviewPresentation";
import { formatScore } from "./EngineEvidence";

type Props = {
  game: Game;
  session: ReturnType<typeof useAnalysis>;
  automatic: boolean;
  position: PositionAnalysis | null;
  ply: number;
  preview: string | null;
  showPrimaryScore: boolean;
  onVariation?: ((line: VariationLine) => void) | undefined;
};

export function WorkspaceEngine(props: Props) {
  const { session, position, preview, automatic } = props;
  const { state, start, cancel, retry } = session;
  const job = state.job;
  const busy = state.status === "loading" || (job !== null && active(job));
  const progress =
    job &&
    reviewPresentation({
      gameId: job.game_id,
      selectedPly: props.ply,
      evidence: null,
      state: job.state,
      mode: job.mode,
      completedPlies: job.completed_plies,
      totalPlies: job.total_plies,
    });
  return (
    <>
      <div className="module-heading engine-heading">
        <h2>{job ? `Stockfish ${job.engine.version}` : "Engine"}</h2>
        <EngineDepth position={position} />
      </div>
      {preview ? (
        <p className="engine-status" role="status">
          {preview}
        </p>
      ) : (
        <EngineLines {...props} />
      )}
      {job && progress && (
        <div className="engine-job">
          <span role="status" aria-label="Analysis progress">
            {job.mode === "quick" ? "Standard" : "Thorough"} ·{" "}
            {progress.statusText} · {progress.coverageText}
          </span>
          {job.can_cancel && (
            <button
              disabled={job.state === "cancel_requested"}
              onClick={cancel}
            >
              Cancel analysis
            </button>
          )}
        </div>
      )}
      {state.status === "loading" && !job && (
        <p role="status">Starting analysis…</p>
      )}
      {state.status === "error" && (
        <p role="alert">
          {state.error.message}
          {state.error.retryAfterSeconds !== null &&
            ` Retry in ${state.error.retryAfterSeconds} seconds.`}
        </p>
      )}
      {(state.status === "error" ||
        job?.state === "failed" ||
        job?.state === "cancelled") && (
        <button onClick={retry}>Retry analysis</button>
      )}
      {!automatic && (
        <div className="analysis-actions">
          <button disabled={busy} onClick={() => start("quick")}>
            Quick review
          </button>
          <button disabled={busy} onClick={() => start("deep")}>
            Deep review
          </button>
        </div>
      )}
    </>
  );
}

export function EngineDepth({
  position,
}: {
  position: PositionAnalysis | null;
}) {
  const depths = position?.lines.map((line) => line.depth);
  if (!depths?.length) return null;
  const min = Math.min(...depths);
  const max = Math.max(...depths);
  return (
    <span className="engine-depth">
      Depth {min === max ? min : `${min}–${max}`}
    </span>
  );
}

export function EngineLines({
  position,
  game,
  ply,
  showPrimaryScore,
  onVariation,
}: Pick<
  Props,
  "position" | "game" | "ply" | "showPrimaryScore" | "onVariation"
>) {
  if (!position)
    return (
      <p className="engine-status" role="status">
        Evaluation pending
      </p>
    );
  return (
    <>
      {position.lines.length === 0 && showPrimaryScore && (
        <p className="line-score" aria-label="White evaluation">
          {formatScore(position.score, 2)}
        </p>
      )}
      {position.lines.length > 0 && (
        <ol className="engine-lines" aria-label="Engine variations">
          {position.lines.map((line, index) => {
            const id = `explore-variation-${index}`;
            const san = line.pv.map((move) => move.san).join(" ");
            const contents = (
              <>
                <span className="line-score">
                  {showPrimaryScore || index !== 0
                    ? formatScore(line.score, 2)
                    : "PV"}
                </span>
                <span>{san}</span>
              </>
            );
            return (
              <li key={id}>
                {onVariation && !line.bounded ? (
                  <button
                    id={id}
                    aria-label={`Explore variation ${index + 1}`}
                    title={san}
                    onClick={() =>
                      onVariation({
                        triggerId: id,
                        rootPly: ply,
                        rootFen: game.positions[ply]?.fen ?? "",
                        positions: line.pv,
                      })
                    }
                  >
                    {contents}
                  </button>
                ) : (
                  <div>{contents}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {position.kind === "played" && (
        <p className="engine-status">Played-line evaluation</p>
      )}
      {position.status !== "usable" && (
        <p className="engine-status">Evidence {position.status}</p>
      )}
      {position.claimableDraw && (
        <p className="engine-status">Draw claim available</p>
      )}
      {position.result && (
        <p className="engine-status">{position.reason ?? "Final position"}</p>
      )}
    </>
  );
}
