import type { PieceRenderObject } from "react-chessboard";

export const boardTheme = {
  dark: "#B58B64",
  light: "#F0D9B5",
  suggestion: "#ACC65B",
};
export const classicPieces: PieceRenderObject = Object.fromEntries(
  ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"].map(
    (piece) => [
      piece,
      () => (
        <img
          src={`/pieces/classic/${piece}.svg`}
          alt=""
          draggable={false}
          style={{ width: "100%", height: "100%" }}
        />
      ),
    ],
  ),
);
