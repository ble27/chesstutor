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
      {game ? (
        new URLSearchParams(window.location.search).get("engine") ===
        "browser" ? (
          <BrowserExperiment game={game} selectedPly={selectedPly} />
        ) : (
          <EnginePanel game={game} selectedPly={selectedPly} />
        )
      ) : (
        <section className="panel" aria-labelledby="engine-title">
          <p className="eyebrow">The position</p>
          <h2 id="engine-title">Engine analysis</h2>
          <p>Engine analysis is not available yet.</p>
        </section>
      )}
      <section className="panel" aria-labelledby="coach-title">
        <p className="eyebrow">The lesson</p>
        <h2 id="coach-title">Chess guidance</h2>
        <p>Chess guidance is not available yet.</p>
      </section>
    </>
  );
}
