import type { Game } from "../../api/discoveryValidation";
import { useReplay } from "./useReplay";
import { MoveList } from "./MoveList";
import { BoardFrame } from "./BoardFrame";
import { PositionText } from "./PositionText";
import { moveLabel } from "./moves";
import { InsightPanels } from "../../InsightPanels";

export function Replay({ game }: { game: Game }) {
  return (
    <ReplaySession
      key={`${game.game.id}:${game.version}:${game.pgn_hash}`}
      game={game}
    />
  );
}

function ReplaySession({ game }: { game: Game }) {
  const lastPly = game.positions.length - 1;
  const { selectedPly, select, orientation, flip, onKeyDown } =
    useReplay(lastPly);
  const position = game.positions[selectedPly];
  if (!position) return null;
  const previous = game.positions[selectedPly - 1];
  const selectedMove = previous
    ? `After ${moveLabel(previous.fen, position.san)}`
    : "Starting position";
  return (
    <section
      className="workspace replay-workspace"
      aria-label="Game replay"
      aria-describedby="replay-help"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <section className="panel replay-panel" aria-labelledby="game-title">
        <h2 id="game-title">Replay both sides</h2>
        <p role="status" aria-label="Replay position" aria-atomic="true">
          {selectedMove} ·{" "}
          {position.fen.split(" ")[1] === "w" ? "White" : "Black"} to move ·{" "}
          {orientation === "white" ? "White" : "Black"} at bottom
        </p>
        <BoardFrame
          players={game.game}
          fen={position.fen}
          orientation={orientation}
          lastMove={position.uci}
        />
        <ReplayControls
          selectedPly={selectedPly}
          lastPly={lastPly}
          select={select}
          flip={flip}
        />
        <PositionText fen={position.fen} />
        <PieceCredit />
      </section>
      <aside className="insights" aria-label="Game insights">
        <section className="panel" aria-labelledby="moves-title">
          <h2 id="moves-title">Game moves</h2>
          <p>
            Recorded moves from this game. Select a move to view its position.
          </p>
          <p id="replay-help">
            Focus this replay area and use Left/Right arrows, Home, or End to
            navigate. Gold outlines mark the last played move.
          </p>
          <MoveList game={game} selectedPly={selectedPly} select={select} />
        </section>
        <InsightPanels />
      </aside>
    </section>
  );
}

function ReplayControls({
  selectedPly,
  lastPly,
  select,
  flip,
}: {
  selectedPly: number;
  lastPly: number;
  select: (ply: number) => void;
  flip: () => void;
}) {
  return (
    <nav aria-label="Replay controls">
      <button disabled={selectedPly === 0} onClick={() => select(0)}>
        First position
      </button>
      <button
        disabled={selectedPly === 0}
        onClick={() => select(selectedPly - 1)}
      >
        Previous move
      </button>
      <button
        disabled={selectedPly === lastPly}
        onClick={() => select(selectedPly + 1)}
      >
        Next move
      </button>
      <button
        disabled={selectedPly === lastPly}
        onClick={() => select(lastPly)}
      >
        Last position
      </button>
      <button onClick={flip}>Flip board</button>
    </nav>
  );
}

function PieceCredit() {
  return (
    <p className="piece-credit">
      Pieces:{" "}
      <a
        href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces"
        target="_blank"
        rel="noreferrer"
      >
        Cburnett
      </a>{" "}
      ·{" "}
      <a
        href="https://creativecommons.org/licenses/by-sa/3.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY-SA 3.0
      </a>
    </p>
  );
}
