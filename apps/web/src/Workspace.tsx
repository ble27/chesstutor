import type { Game } from "./api/discoveryValidation";
import { Replay } from "./features/replay/Replay";

export function Workspace({ game }: { game: Game | null }) {
  return (
    <div className="workspace">
      <section
        className={`panel ${game ? "replay-panel" : "game-space"}`}
        aria-labelledby="game-title"
      >
        {game ? (
          <>
            <h2 id="game-title">Replay both sides</h2>
            <Replay game={game} />
          </>
        ) : (
          <>
            <span className="workspace-mark" aria-hidden="true">
              ♘
            </span>
            <h2 id="game-title">Your game, in focus</h2>
            <p>A space to replay both sides and discover the turning points.</p>
          </>
        )}
      </section>
      <aside className="insights" aria-label="Game insights">
        <section className="panel" aria-labelledby="engine-title">
          <p className="eyebrow">The position</p>
          <h2 id="engine-title">Engine analysis</h2>
          <p>Engine analysis is not available yet.</p>
        </section>
        <section className="panel" aria-labelledby="coach-title">
          <p className="eyebrow">The lesson</p>
          <h2 id="coach-title">Chess guidance</h2>
          <p>Chess guidance is not available yet.</p>
        </section>
      </aside>
    </div>
  );
}
