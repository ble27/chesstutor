import type { CSSProperties } from "react";
import { Chessboard } from "react-chessboard";

export function Board({
  fen,
  orientation,
  lastMove,
}: {
  fen: string;
  orientation: "white" | "black";
  lastMove: string | null;
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
    >
      <div aria-hidden="true" inert style={{ height: "100%" }}>
        <Chessboard
          options={{
            id: "game-replay",
            position: fen,
            boardOrientation: orientation,
            allowDragging: false,
            allowDrawingArrows: false,
            showAnimations: false,
            darkSquareStyle: { backgroundColor: "#637878" },
            lightSquareStyle: { backgroundColor: "#e0dfd5" },
            darkSquareNotationStyle: { color: "#ffffff" },
            lightSquareNotationStyle: { color: "#181818" },
            squareStyles,
          }}
        />
      </div>
    </div>
  );
}
