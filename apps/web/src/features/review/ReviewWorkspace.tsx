import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Analysis } from "../../api/analysis";
import type { Evidence } from "../../api/analysisEvidence";
import { active } from "../../api/analysis";
import { LocalAnalysisControls } from "../analysis/LocalAnalysisControls";
import type { LocalAnalysis } from "../analysis/useLocalAnalysis";
import type { BoardArrow } from "../guidance/arrows";
import { ReviewReport } from "./ReviewReport";
import { BrowserExperiment } from "../browserExperiment/BrowserExperiment";
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
          ? (localAnalysis?.live.lines[0]?.score ?? null)
          : (position?.score ?? null)
      }
      engine={
        <WorkspaceEngine
          game={game}
          session={session}
          automatic={props.automatic === true}
          position={position}
          ply={ply}
          preview={preview}
          showPrimaryScore={!props.board}
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
        <EvaluationGraph
          game={game}
          evidence={job?.evidence ?? []}
          reviews={job?.classifications}
          selectedPly={ply}
          select={props.selectPosition ?? props.select}
        />
      }
      local={localAnalysis && <LocalAnalysisControls local={localAnalysis} />}
    />
  );
}

type LayoutProps = Props & {
  score: Score | null;
  engine: ReactNode;
  graph?: ReactNode;
  settings?: ReactNode;
  analysis: Analysis | null;
  local?: ReactNode;
};

function ReviewLayout(props: LayoutProps) {
  const {
    game,
    selectedPly,
    select,
    flip,
    localAnalysis,
    variation,
    board,
    score,
    settings,
    analysis,
    local,
  } = props;
  const [mode, setMode] = useState("analysis");
  const changeMode = (value: string) => {
    variation?.exit();
    localAnalysis?.setRefine(false);
    localAnalysis?.setPromotion(null);
    if (value === "self") localAnalysis?.sandbox.begin(selectedPly);
    else localAnalysis?.sandbox.exit();
    setMode(value);
  };
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
      <aside
        className="review-modules workspace-modes"
        aria-label="Game insights"
      >
        <Tabs.Root
          value={mode}
          onValueChange={changeMode}
          activationMode="manual"
        >
          <div className="workspace-nav">
            <Tabs.List aria-label="Review mode" className="workspace-tablist">
              <Tabs.Trigger value="report">Report</Tabs.Trigger>
              {local && <Tabs.Trigger value="self">Self-analysis</Tabs.Trigger>}
              <Tabs.Trigger value="analysis">Analysis</Tabs.Trigger>
            </Tabs.List>
            {settings}
          </div>
          <Tabs.Content value="report" className="workspace-view">
            <ReviewReport
              game={game}
              selectedPly={selectedPly}
              select={select}
              analysis={analysis}
            />
          </Tabs.Content>
          {local && (
            <Tabs.Content value="self" className="workspace-view">
              {local}
            </Tabs.Content>
          )}
          <Tabs.Content value="analysis" className="workspace-view">
            <RecordedAnalysis {...props} />
          </Tabs.Content>
        </Tabs.Root>
        {!board && footer}
      </aside>
    </>
  );
}

function RecordedAnalysis({
  game,
  engine,
  graph,
  variation,
  analysis,
  selectedPly,
  onArrows,
  coachArrows,
}: Pick<
  LayoutProps,
  | "game"
  | "engine"
  | "graph"
  | "variation"
  | "analysis"
  | "selectedPly"
  | "onArrows"
  | "coachArrows"
>) {
  return (
    <>
      <section className="panel review-engine" aria-label="Engine analysis">
        {engine}
        {variation?.kind !== "variation" && (
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
        selectedSan={game.positions[selectedPly]?.san ?? undefined}
        onArrows={onArrows ?? noArrows}
        suspended={variation?.kind === "variation"}
        arrowsVisible={coachArrows?.visible}
        onArrowsVisible={coachArrows?.setVisible}
      />
    </>
  );
}
