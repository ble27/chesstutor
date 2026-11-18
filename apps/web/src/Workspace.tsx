import type { Game } from "./api/discoveryValidation";
import { Replay } from "./features/replay/Replay";

export function Workspace({ game }: { game: Game | null }) {
  if (game) return <Replay game={game} automatic />;
  return (
    <section className="workspace-empty" aria-labelledby="engine-title">
      <h2 id="engine-title">Engine analysis</h2>
      <p>
        Open a game from the library to replay its moves and request an
        independent Stockfish review.
      </p>
    </section>
  );
}
