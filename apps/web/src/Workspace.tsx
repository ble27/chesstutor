import type { Game } from "./api/discoveryValidation";
import { Replay } from "./features/replay/Replay";
import { InsightPanels } from "./InsightPanels";

export function Workspace({ game }: { game: Game | null }) {
  if (game) return <Replay game={game} />;
  return (
    <div className="workspace">
      <section className="panel game-space" aria-labelledby="game-title">
        <span className="workspace-mark" aria-hidden="true">
          ♘
        </span>
        <h2 id="game-title">Your game, in focus</h2>
        <p>A space to replay both sides and discover the turning points.</p>
      </section>
      <aside className="insights" aria-label="Game insights">
        <InsightPanels />
      </aside>
    </div>
  );
}
