import type { Analysis } from "../../api/analysis";
import { active } from "../../api/analysis";
import type { Game } from "../../api/discoveryValidation";
import { useAnalysis } from "./useAnalysis";
import { EngineEvidence } from "./EngineEvidence";
import { PositionEvidence } from "./PositionEvidence";
import {
  ClassificationPanel,
  SelectedMoveClassification,
} from "./ClassificationPanel";

const statuses = {
  queued: "Queued",
  running: "Running",
  cancel_requested: "Cancellation requested",
  cancelled: "Cancelled",
  completed: "Completed",
  failed: "Failed",
};

export function EnginePanel({
  game,
  selectedPly,
}: {
  game: Game;
  selectedPly: number;
}) {
  return (
    <EngineSession
      key={`${game.game.id}:${game.version}:${game.pgn_hash}`}
      game={game}
      selectedPly={selectedPly}
    />
  );
}

function EngineSession({
  game,
  selectedPly,
}: {
  game: Game;
  selectedPly: number;
}) {
  const session = useAnalysis(game);
  return <EngineView game={game} selectedPly={selectedPly} session={session} />;
}

export function EngineView({
  game,
  selectedPly,
  session,
  workspace = false,
}: {
  game: Game;
  selectedPly: number;
  session: ReturnType<typeof useAnalysis>;
  workspace?: boolean;
}) {
  const { state, start, cancel, retry } = session;
  const job = state.job;
  const busy = state.status === "loading" || (job !== null && active(job));
  return (
    <section className="panel engine-panel" aria-labelledby="engine-title">
      <h2 id="engine-title">Engine analysis</h2>
      {workspace && (
        <PositionEvidence
          game={game}
          selectedPly={selectedPly}
          evidence={job?.evidence ?? []}
        />
      )}
      {workspace && job && (
        <SelectedMoveClassification job={job} selectedPly={selectedPly} />
      )}
      <AnalysisLimits />
      <div className="analysis-actions">
        <button disabled={busy} onClick={() => start("quick")}>
          Quick review
        </button>
        <button disabled={busy} onClick={() => start("deep")}>
          Deep review
        </button>
        {job?.can_cancel && (
          <button
            disabled={
              state.status === "loading" || job.state === "cancel_requested"
            }
            onClick={cancel}
          >
            Cancel analysis
          </button>
        )}
      </div>
      {state.status === "loading" && (
        <p aria-live="polite">Sending analysis request…</p>
      )}
      {state.status === "error" && (
        <p role="alert">
          {state.error.message}
          {state.error.retryAfterSeconds !== null &&
            ` Retry in ${state.error.retryAfterSeconds} seconds.`}
        </p>
      )}
      {job && (
        <EngineJob job={job} selectedPly={selectedPly} workspace={workspace} />
      )}
      {(state.status === "error" ||
        job?.state === "failed" ||
        job?.state === "cancelled") && (
        <button onClick={retry}>Retry analysis</button>
      )}
    </section>
  );
}

function AnalysisLimits() {
  return (
    <details className="analysis-limits">
      <summary>Review settings and limits</summary>
      <p>
        Quick: 100ms per search. Deep: 750ms per search. Limit: one active job,
        five Quick and two Deep reviews per hour. Shared-network limits also
        apply; cached results are free.
      </p>
    </details>
  );
}

function EngineJob({
  job,
  selectedPly,
  workspace,
}: {
  job: Analysis;
  selectedPly: number;
  workspace: boolean;
}) {
  const evidence = job.evidence.find((item) => item.ply === selectedPly);
  return (
    <>
      <p role="status" aria-label="Analysis progress">
        {job.mode === "quick" ? "Quick" : "Deep"} · {statuses[job.state]} ·{" "}
        {job.completed_plies}/{job.total_plies} plies
      </p>
      <progress
        aria-label="Analysed plies"
        value={job.completed_plies}
        max={job.total_plies}
      />
      {job.dispatch_pending && (
        <p>Waiting for worker dispatch; the job is saved.</p>
      )}
      {job.cached && (
        <p>
          Reusing a completed {job.mode === "quick" ? "Quick" : "Deep"} review.
        </p>
      )}
      {(job.state === "failed" || job.state === "cancelled") && (
        <p>
          Partial evidence retained.{" "}
          {job.error_code === "timeout"
            ? "The analysis deadline was reached."
            : "The full game was not analysed."}
        </p>
      )}
      {!workspace &&
        (evidence ? (
          <EngineEvidence evidence={evidence} />
        ) : (
          <p>
            {selectedPly === 0
              ? "Select a played move to inspect its pre-move evidence."
              : "Evidence for this move is pending."}
          </p>
        ))}
      {!workspace && (
        <ClassificationPanel job={job} selectedPly={selectedPly} />
      )}
      <p className="engine-provenance">
        Stockfish {String(job.engine.version)}
      </p>
    </>
  );
}
