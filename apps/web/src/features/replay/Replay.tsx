import { useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import { useVariation } from "../review/useVariation";
import { useReplay, replayKeyDown } from "./useReplay";
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
  const { selectedPly, select, orientation } = useReplay(lastPly);
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const position = game.positions[selectedPly];
  const variation = useVariation({
    selectedPly,
    fen: position?.fen ?? "",
    orientation,
  });
  if (!position) return null;
  const previous = game.positions[selectedPly - 1];
  const preview =
    variation.kind === "game" &&
    arrows.length > 0 &&
    previous &&
    arrows.every(
      (arrow) => arrow.ply === selectedPly && arrow.rootFen === previous.fen,
    );
  const boardPosition =
    variation.kind === "variation"
      ? { ...position, fen: variation.fen, uci: variation.lastMove }
      : preview
        ? previous
        : position;
  const selectedMove =
    variation.kind === "variation"
      ? `Variation from ply ${variation.rootPly} · ${variation.step} of ${variation.length}${variation.san ? ` · ${variation.san}` : ""}`
      : previous
        ? `${preview ? "Before" : "After"} ${moveLabel(previous.fen, position.san)}`
        : "Starting position";
  return (
    <section
      id="review-workspace"
      className="workspace replay-workspace"
      aria-label="Game replay"
      aria-describedby="replay-help"
      tabIndex={0}
      onKeyDown={(event) =>
        replayKeyDown(
          event,
          variation.kind === "variation" ? variation.step : selectedPly,
          variation.kind === "variation" ? variation.length : lastPly,
          variation.kind === "variation" ? variation.select : select,
        )
      }
    >
      <ReplayBoard
        game={game}
        selectedMove={selectedMove}
        fen={boardPosition.fen}
        orientation={variation.orientation}
        lastMove={preview ? null : boardPosition.uci}
        arrows={preview ? arrows : []}
      />
      <ReviewWorkspace
        game={game}
        selectedPly={selectedPly}
        select={(ply) => {
          variation.exit();
          select(ply);
        }}
        flip={variation.flip}
        variation={variation}
        onArrows={setArrows}
      />
    </section>
  );
}

function PieceCredit() {
  return (
    <p className="piece-credit">
      Pieces:{" "}
      <a href="/pieces/classic/README.md" target="_blank" rel="noreferrer">
        Classic Merida · Armando Hernandez Marroquin
      </a>{" "}
      ·{" "}
      <a href="/pieces/classic/LICENSE.txt" target="_blank" rel="noreferrer">
        GPL-2.0-or-later
      </a>
    </p>
  );
}

function ReplayBoard({
  game,
  selectedMove,
  fen,
  orientation,
  lastMove,
  arrows,
}: {
  game: Game;
  selectedMove: string;
  fen: string;
  orientation: "white" | "black";
  lastMove: string | null;
  arrows: BoardArrow[];
}) {
  return (
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
        {selectedMove} · {fen.split(" ")[1] === "w" ? "White" : "Black"} to move
        · {orientation === "white" ? "White" : "Black"} at bottom
      </p>
      <BoardFrame
        players={game.game}
        fen={fen}
        orientation={orientation}
        lastMove={lastMove}
        arrows={arrows}
      />
      <PositionText fen={fen} />
      <PieceCredit />
    </section>
  );
}
