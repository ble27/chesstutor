import type { Game } from "../../api/discoveryValidation";
import { useReplay } from "./useReplay";
import { MoveList } from "./MoveList";
import { Board } from "./Board";
import { PositionText } from "./PositionText";
import { moveLabel } from "./moves";

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
    <section aria-label="Game replay" tabIndex={0} onKeyDown={onKeyDown}>
      <p>
        Focus this replay area and use Left/Right arrows, Home, or End to
        navigate. Gold outlines mark the last played move.
      </p>
      <p role="status" aria-label="Replay position" aria-atomic="true">
        {selectedMove} ·{" "}
        {position.fen.split(" ")[1] === "w" ? "White" : "Black"} to move ·{" "}
        {orientation === "white" ? "White" : "Black"} at bottom
      </p>
      <Board
        fen={position.fen}
        orientation={orientation}
        lastMove={position.uci}
      />
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
      <MoveList game={game} selectedPly={selectedPly} select={select} />
      <PositionText fen={position.fen} />
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
    </section>
  );
}
