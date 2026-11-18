import { LocalAnalysisControls } from "../analysis/LocalAnalysisControls";
import type { LocalAnalysis } from "../analysis/useLocalAnalysis";
import type { Variation } from "./useVariation";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Analysis } from "../../api/analysis";
import { active } from "../../api/analysis";
import { MoveList } from "../replay/MoveList";
import { BrowserExperiment } from "../browserExperiment/BrowserExperiment";
import { useAnalysis } from "./useAnalysis";
import { EngineView } from "./EnginePanel";
import { ClassificationSummary } from "./ClassificationSummary";
import type { LocalSettings } from "./EngineSettings";
import { EngineSettings, defaultLocalSettings } from "./EngineSettings";
import { EvaluationGraph } from "./EvaluationGraph";
import { CoachPanel } from "./CoachPanel";
import type { BoardArrow } from "../guidance/arrows";
import { VariationFooter } from "./VariationFooter";
import { ReviewTabs } from "./ReviewTabs";
import type { ReviewTab } from "./ReviewTabs";

type Props = {
  localAnalysis?: LocalAnalysis;
  automatic?: boolean;
  game: Game;
  selectedPly: number;
  positionPly?: number;
  coachArrows?: { visible: boolean; setVisible: (visible: boolean) => void };
  selectPosition?: (ply: number) => void;
  select: (ply: number) => void;
  flip: () => void;
  onArrows?: (arrows: BoardArrow[]) => void;
  moveReviews?: Analysis["classifications"];
  variation?: Variation | undefined;
};

const noArrows = () => undefined;

export function ReviewWorkspace(props: Props) {
  return new URLSearchParams(window.location.search).get("engine") ===
    "browser" ? (
    <ReviewShell
      {...props}
      analysis={
        <BrowserExperiment game={props.game} selectedPly={props.selectedPly} />
      }
      guidance={() => (
        <p>
          Chess guidance needs a server-verified review. The browser experiment
          does not provide it.
        </p>
      )}
      review={() => (
        <p>
          Browser evidence is provisional. Server-verified game summaries are
          unavailable in this experiment.
        </p>
      )}
    />
  ) : (
    <ServerWorkspace {...props} />
  );
}

function ServerWorkspace(props: Props) {
  const session = useAnalysis(props.game, props.automatic);
  const [fallbackLocal, setFallbackLocal] = useState(defaultLocalSettings);
  const local = props.localAnalysis?.settings ?? fallbackLocal;
  const setLocal = props.localAnalysis?.setSettings ?? setFallbackLocal;
  const summary = session.state.job?.summary;
  return (
    <ReviewShell
      {...props}
      moveReviews={session.state.job?.classifications}
      analysis={
        <ServerAnalysis
          props={props}
          session={session}
          local={local}
          setLocal={setLocal}
        />
      }
      graph={
        !props.localAnalysis?.sandbox.enabled && (
          <EvaluationGraph
            game={props.game}
            evidence={session.state.job?.evidence ?? []}
            reviews={session.state.job?.classifications}
            selectedPly={props.positionPly ?? props.selectedPly}
            select={props.selectPosition ?? props.select}
          />
        )
      }
      guidance={() => (
        <WorkspaceCoach props={props} analysis={session.state.job} />
      )}
      review={(selectMoment) =>
        summary ? (
          <>
            <p>
              {summary.coverage.classified_plies} of{" "}
              {summary.coverage.total_plies} plies classified
              {!summary.is_final && " · analysis incomplete"}
            </p>
            <ClassificationSummary
              summary={summary}
              accuracy={session.state.job?.accuracy}
              reviews={session.state.job?.classifications}
              players={props.game.game}
            />
            {summary.critical_moments.map((moment) => (
              <button key={moment.ply} onClick={() => selectMoment(moment.ply)}>
                Inspect ply {moment.ply} · {moment.label}
              </button>
            ))}
          </>
        ) : (
          <p>
            Run a review to see game summaries, mistakes, and blunders. Partial
            analysis will show its coverage.
          </p>
        )
      }
    />
  );
}

function ReviewShell({
  game,
  selectedPly,
  select,
  flip,
  moveReviews,
  localAnalysis,
  variation,
  analysis,
  graph,
  guidance,
  review,
}: Props & {
  analysis: ReactNode;
  graph?: ReactNode;
  guidance: () => ReactNode;
  review: (selectMoment: (ply: number) => void) => ReactNode;
}) {
  const [tab, setTab] = useState<ReviewTab>("Analysis");
  const selectMoment = (ply: number) => {
    select(ply);
    setTab("Analysis");
    document.getElementById("tab-analysis")?.focus();
  };
  return (
    <aside className="insights" aria-label="Game insights">
      <section className="panel review-panel" aria-label="Game review">
        <div className="workspace-coach">{guidance()}</div>
        <ReviewTabs
          selected={tab}
          select={(next) => {
            variation?.exit();
            setTab(next);
          }}
        />
        <div
          id="view-analysis"
          role="tabpanel"
          aria-labelledby="tab-analysis"
          hidden={tab !== "Analysis"}
          className="analysis-tab"
        >
          {graph && <div className="review-graph">{graph}</div>}
          <div className="analysis-region">{analysis}</div>
          <div className="review-moves">
            <MoveList
              game={game}
              selectedPly={selectedPly}
              select={select}
              reviews={moveReviews}
            />
          </div>
        </div>
        <div
          id="view-review"
          role="tabpanel"
          aria-labelledby="tab-review"
          hidden={tab !== "Review"}
          className="review-tab-content"
        >
          {tab === "Review" && review(selectMoment)}
        </div>
        <VariationFooter
          selectedPly={selectedPly}
          lastPly={game.positions.length - 1}
          select={select}
          flip={flip}
          variation={variation}
          sandbox={localAnalysis?.sandbox}
        />
      </section>
    </aside>
  );
}

function ServerAnalysis({
  props,
  session,
  local,
  setLocal,
}: {
  props: Props;
  session: ReturnType<typeof useAnalysis>;
  local: LocalSettings;
  setLocal: (settings: LocalSettings) => void;
}) {
  return (
    <>
      {props.localAnalysis?.sandbox.enabled && (
        <EngineSettings
          busy={
            session.state.status === "loading" ||
            (session.state.job !== null && active(session.state.job))
          }
          start={session.start}
          local={local}
          setLocal={setLocal}
        />
      )}
      {!props.localAnalysis?.sandbox.enabled && (
        <EngineView
          game={props.game}
          selectedPly={props.selectedPly}
          session={session}
          workspace
          automatic={props.automatic}
          local={local}
          setLocal={setLocal}
          positionPly={props.positionPly ?? props.selectedPly}
          onVariation={(line) => {
            props.localAnalysis?.setRefine(false);
            props.variation?.enter(line);
          }}
          variation={props.variation}
        />
      )}{" "}
      {props.localAnalysis && (
        <LocalAnalysisControls
          local={props.localAnalysis}
          selectedPly={props.positionPly ?? props.selectedPly}
          leaveVariation={props.variation?.exit ?? noArrows}
        />
      )}
    </>
  );
}

function WorkspaceCoach({
  props,
  analysis,
}: {
  props: Props;
  analysis: Analysis | null;
}) {
  const suspended =
    props.localAnalysis?.sandbox.enabled === true ||
    props.variation?.kind === "variation";
  return (
    <>
      {suspended && (
        <p role="status">
          {props.localAnalysis?.sandbox.enabled
            ? "Free analysis is separate from recorded move coaching. Return to game to resume your lesson."
            : "Exploring an engine variation. Return to the game for the recorded move’s coaching."}
        </p>
      )}
      <div hidden={suspended}>
        <CoachPanel
          analysis={analysis}
          selectedPly={props.selectedPly}
          onArrows={props.onArrows ?? noArrows}
          suspended={suspended}
          arrowsVisible={props.coachArrows?.visible}
          onArrowsVisible={props.coachArrows?.setVisible}
        />
      </div>
    </>
  );
}
