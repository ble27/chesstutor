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
  onMove,
  legalMoves = [],
}: {
  fen: string;
  orientation: "white" | "black";
  lastMove: string | null;
  describedBy: string;
  arrows?: BoardArrow[] | undefined;
  onMove?: ((move: string) => void) | undefined;
  legalMoves?: readonly string[] | undefined;
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
      <div aria-hidden="true" inert={!onMove} style={{ height: "100%" }}>
        <Chessboard
          options={{
            id: "game-replay",
            position: fen,
            pieces: classicPieces,
            boardOrientation: orientation,
            allowDragging: onMove !== undefined,
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (targetSquare) {
                const choices = legalMoves.filter((move) =>
                  move.startsWith(sourceSquare + targetSquare),
                );
                if (choices.length === 1 && choices[0]) onMove?.(choices[0]);
                else if (choices.length > 1)
                  onMove?.(sourceSquare + targetSquare);
              }
              return false;
            },
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
