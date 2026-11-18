import type { Variation } from "./useVariation";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Analysis } from "../../api/analysis";
import { MoveList } from "../replay/MoveList";
import { BrowserExperiment } from "../browserExperiment/BrowserExperiment";
import { useAnalysis } from "./useAnalysis";
import { EngineView } from "./EnginePanel";
import { ClassificationSummary } from "./ClassificationSummary";
import { GuidancePanel } from "../guidance/GuidancePanel";
import type { BoardArrow } from "../guidance/arrows";
import { VariationFooter } from "./VariationFooter";
import { ReviewTabs } from "./ReviewTabs";
import type { ReviewTab } from "./ReviewTabs";

type Props = {
  game: Game;
  selectedPly: number;
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
  const session = useAnalysis(props.game);
  const summary = session.state.job?.summary;
  return (
    <ReviewShell
      {...props}
      moveReviews={session.state.job?.classifications}
      analysis={
        <EngineView
          game={props.game}
          selectedPly={props.selectedPly}
          session={session}
          workspace
          onVariation={props.variation?.enter}
          variation={props.variation}
        />
      }
      guidance={() => (
        <GuidancePanel
          analysis={session.state.job}
          selectedPly={props.selectedPly}
          onArrows={props.onArrows ?? noArrows}
        />
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
  variation,
  analysis,
  guidance,
  review,
}: Props & {
  analysis: ReactNode;
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
        <div
          id="view-chess-guidance"
          role="tabpanel"
          aria-labelledby="tab-chess-guidance"
          hidden={tab !== "Chess guidance"}
          className="review-tab-content"
        >
          <h2>Chess guidance</h2>
          {tab === "Chess guidance" && guidance()}
        </div>
        <VariationFooter
          selectedPly={selectedPly}
          lastPly={game.positions.length - 1}
          select={select}
          flip={flip}
          variation={variation}
        />
      </section>
    </aside>
  );
}
