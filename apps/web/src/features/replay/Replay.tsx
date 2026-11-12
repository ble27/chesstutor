import { useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import { useReplay } from "./useReplay";
import { ReviewWorkspace } from "../review/ReviewWorkspace";
import { BoardFrame } from "./BoardFrame";
import { PositionText } from "./PositionText";
import { moveLabel } from "./moves";
import type { BoardArrow } from "../guidance/arrows";

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
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const position = game.positions[selectedPly];
  if (!position) return null;
  const previous = game.positions[selectedPly - 1];
  const preview =
    arrows.length > 0 &&
    previous &&
    arrows.every(
      (arrow) => arrow.ply === selectedPly && arrow.rootFen === previous.fen,
    );
  const boardPosition = preview ? previous : position;
  const selectedMove = previous
    ? `${preview ? "Before" : "After"} ${moveLabel(previous.fen, position.san)}`
    : "Starting position";
  return (
    <section
      id="review-workspace"
      className="workspace replay-workspace"
      aria-label="Game replay"
      aria-describedby="replay-help"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <section className="panel replay-panel" aria-labelledby="game-title">
        <h2 id="game-title" className="visually-hidden">
          Replay both sides
        </h2>
        <p
          role="status"
          aria-label="Replay position"
          aria-atomic="true"
          className="replay-position"
        >
          {selectedMove} ·{" "}
          {boardPosition.fen.split(" ")[1] === "w" ? "White" : "Black"} to move
          · {orientation === "white" ? "White" : "Black"} at bottom
        </p>
        <BoardFrame
          players={game.game}
          fen={boardPosition.fen}
          orientation={orientation}
          lastMove={preview ? null : position.uci}
          arrows={preview ? arrows : []}
        />
        <PositionText fen={boardPosition.fen} />
        <PieceCredit />
      </section>
      <ReviewWorkspace
        game={game}
        selectedPly={selectedPly}
        select={select}
        flip={flip}
        onArrows={setArrows}
      />
    </section>
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
