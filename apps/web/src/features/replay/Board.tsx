import { boardTheme, classicPieces } from "./boardTheme";
import type { CSSProperties } from "react";
import { Chessboard, defaultArrowOptions } from "react-chessboard";
import type { BoardArrow } from "../guidance/arrows";

export function Board({
  fen,
  orientation,
  lastMove,
  describedBy,
  arrows = [],
}: {
  fen: string;
  orientation: "white" | "black";
  lastMove: string | null;
  describedBy: string;
  arrows?: BoardArrow[] | undefined;
}) {
  const squareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    for (const square of [lastMove.slice(0, 2), lastMove.slice(2, 4)])
      squareStyles[square] = {
        boxShadow: "inset 0 0 0 3px #181818, inset 0 0 0 6px #eac96a",
      };
  }
  return (
    <div
      className="replay-board"
      role="img"
      aria-label={`Chessboard, ${orientation === "white" ? "White" : "Black"} at bottom`}
      aria-describedby={describedBy}
    >
      <div aria-hidden="true" inert style={{ height: "100%" }}>
        <Chessboard
          options={{
            id: "game-replay",
            position: fen,
            pieces: classicPieces,
            boardOrientation: orientation,
            allowDragging: false,
            allowDrawingArrows: false,
            arrows,
            arrowOptions: {
              ...defaultArrowOptions,
              opacity: 0.8,
              arrowWidthDenominator: 12.5,
            },
            showAnimations: false,
            darkSquareStyle: { backgroundColor: boardTheme.dark },
            lightSquareStyle: { backgroundColor: boardTheme.light },
            darkSquareNotationStyle: { color: "#181818" },
            lightSquareNotationStyle: { color: "#181818" },
            squareStyles,
          }}
        />
      </div>
    </div>
  );
}
