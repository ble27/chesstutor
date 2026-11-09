import type { Game } from "./api/discoveryValidation";
import { EnginePanel } from "./features/review/EnginePanel";
import { BrowserExperiment } from "./features/browserExperiment/BrowserExperiment";

export function InsightPanels({
  game,
  selectedPly = 0,
}: {
  game?: Game;
  selectedPly?: number;
}) {
  return (
    <>
      <EngineInsight game={game} selectedPly={selectedPly} />
      <CoachInsight />
    </>
  );
}

export function EngineInsight({
  game,
  selectedPly = 0,
}: {
  game?: Game | undefined;
  selectedPly?: number;
}) {
  return game ? (
    new URLSearchParams(window.location.search).get("engine") === "browser" ? (
      <BrowserExperiment game={game} selectedPly={selectedPly} />
    ) : (
      <EnginePanel game={game} selectedPly={selectedPly} />
    )
  ) : (
    <section className="panel" aria-labelledby="engine-title">
      <h2 id="engine-title">Engine analysis</h2>
      <p>Engine analysis is not available yet.</p>
    </section>
  );
}

export function CoachInsight() {
  return (
    <section className="panel" aria-labelledby="coach-title">
      <h2 id="coach-title">Chess guidance</h2>
      <p>Chess guidance is not available yet.</p>
    </section>
  );
}
