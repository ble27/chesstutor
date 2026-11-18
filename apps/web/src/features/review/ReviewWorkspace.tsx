import { useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Analysis } from "../../api/analysis";
import type { Evidence } from "../../api/analysisEvidence";
import { active } from "../../api/analysis";
import { LocalAnalysisControls } from "../analysis/LocalAnalysisControls";
import type { LocalAnalysis } from "../analysis/useLocalAnalysis";
import type { BoardArrow } from "../guidance/arrows";
import { MoveList } from "../replay/MoveList";
import { BrowserExperiment } from "../browserExperiment/BrowserExperiment";
import { useReviewScroll } from "./useReviewScroll";
import { useAnalysis } from "./useAnalysis";
import { WorkspaceEngine } from "./WorkspaceEngine";
import { EngineSettings, defaultLocalSettings } from "./EngineSettings";
import { EvaluationGraph } from "./EvaluationGraph";
import { CoachPanel } from "./CoachPanel";
import { VariationFooter } from "./VariationFooter";
import type { Variation } from "./useVariation";
import { ProofEvidence } from "./ProofEvidence";
import { positionAnalysis } from "./positionAnalysis";

type Score = Evidence["played"]["score"];

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
  variation?: Variation | undefined;
  board?: (score: Score | null, footer: ReactNode) => ReactNode;
};

const noArrows = () => undefined;

export function ReviewWorkspace(props: Props) {
  if (new URLSearchParams(window.location.search).get("engine") === "browser")
    return (
      <BrowserExperiment
        game={props.game}
        selectedPly={props.selectedPly}
        workspace={(engine, position) => (
          <ReviewLayout
            {...props}
            analysis={null}
            score={position?.score ?? null}
            engine={engine}
          />
        )}
      />
    );
  return <ServerWorkspace {...props} />;
}

function ServerWorkspace(props: Props) {
  const session = useAnalysis(props.game, props.automatic);
  const [fallbackLocal, setFallbackLocal] = useState(defaultLocalSettings);
  const { game, localAnalysis, variation } = props;
  const job = session.state.job;
  const ply = props.positionPly ?? props.selectedPly;
  const sandbox = localAnalysis?.sandbox.enabled === true;
  const preview = variation?.kind === "variation";
  const localActive = sandbox || localAnalysis?.refine === true;
  const position =
    sandbox || preview
      ? null
      : positionAnalysis(game, ply, job?.evidence ?? []);
  return (
    <ReviewLayout
      {...props}
      analysis={job}
      score={
        localActive
          ? (localAnalysis?.live.line?.score ?? null)
          : (position?.score ?? null)
      }
      engine={
        <WorkspaceEngine
          game={game}
          session={session}
          automatic={props.automatic === true}
          position={position}
          ply={ply}
          preview={sandbox ? "Free analysis" : preview ? "Variation" : null}
          showPrimaryScore={!props.board || localActive}
          onVariation={
            variation &&
            ((line) => {
              localAnalysis?.setRefine(false);
              variation.enter(line);
            })
          }
        />
      }
      settings={
        <EngineSettings
          busy={
            session.state.status === "loading" || (job !== null && active(job))
          }
          start={session.start}
          local={localAnalysis?.settings ?? fallbackLocal}
          setLocal={localAnalysis?.setSettings ?? setFallbackLocal}
        />
      }
      graph={
        !sandbox && (
          <EvaluationGraph
            game={game}
            evidence={job?.evidence ?? []}
            reviews={job?.classifications}
            selectedPly={ply}
            select={props.selectPosition ?? props.select}
          />
        )
      }
      local={
        localAnalysis && (
          <LocalAnalysisControls
            local={localAnalysis}
            selectedPly={ply}
            leaveVariation={variation?.exit ?? noArrows}
          />
        )
      }
    />
  );
}

function ReviewLayout({
  game,
  selectedPly,
  select,
  flip,
  localAnalysis,
  variation,
  coachArrows,
  onArrows,
  board,
  score,
  engine,
  graph,
  settings,
  analysis,
  local,
}: Props & {
  score: Score | null;
  engine: ReactNode;
  graph?: ReactNode;
  settings?: ReactNode;
  analysis: Analysis | null;
  local?: ReactNode;
}) {
  const scroll = useReviewScroll();
  const footer = (
    <VariationFooter
      selectedPly={selectedPly}
      lastPly={game.positions.length - 1}
      select={select}
      flip={flip}
      variation={variation}
      sandbox={localAnalysis?.sandbox}
    />
  );
  return (
    <>
      {board?.(score, footer)}
      <aside ref={scroll} className="review-modules" aria-label="Game insights">
        <section className="panel review-engine" aria-label="Engine analysis">
          {settings}
          {engine}
          {local}
          {!localAnalysis?.sandbox.enabled &&
            variation?.kind !== "variation" && (
              <ProofEvidence
                compact
                move={analysis?.classifications?.find(
                  (move) => move.ply === selectedPly,
                )}
                themes={[]}
              />
            )}
        </section>
        {graph}
        <CoachPanel
          analysis={analysis}
          selectedPly={selectedPly}
          onArrows={onArrows ?? noArrows}
          suspended={
            localAnalysis?.sandbox.enabled === true ||
            variation?.kind === "variation"
          }
          arrowsVisible={coachArrows?.visible}
          onArrowsVisible={coachArrows?.setVisible}
        />
        <section className="panel moves-module" aria-labelledby="moves-title">
          <div className="module-heading">
            <h2 id="moves-title">Moves</h2>
            <AccuracyReadout analysis={analysis} />
          </div>
          <div className="move-columns" aria-hidden="true">
            <span>#</span>
            <span>White</span>
            <span>Black</span>
          </div>
          <MoveList
            game={game}
            selectedPly={selectedPly}
            select={select}
            reviews={analysis?.classifications}
          />
        </section>
        {!board && footer}
      </aside>
    </>
  );
}

function AccuracyReadout({ analysis }: { analysis: Analysis | null }) {
  const accuracy = analysis?.accuracy;
  if (!accuracy) return null;
  const players = accuracy.players;
  return (
    <div className="accuracy-readout" aria-label="Accuracy">
      <span>Accuracy</span>
      {(["white", "black"] as const).map((color) => {
        const item = players[color];
        if (!item) return null;
        return (
          <span key={color}>
            <i className={`piece-color ${color}`} aria-hidden="true" />
            <span className="visually-hidden">{color} </span>
            {item.accuracy == null ? "—" : `${item.accuracy.toFixed(1)}%`}
            <span
              className="accuracy-coverage"
              aria-label={`${item.scored_plies} of ${item.total_plies} scored plies`}
            >
              {item.scored_plies}/{item.total_plies}
            </span>
          </span>
        );
      })}
    </div>
  );
}
