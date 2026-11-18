import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { fenStringToPositionObject } from "react-chessboard";

const pieceNames: Record<string, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

export function useBoardInput(
  fen: string,
  legalMoves: readonly string[],
  play?: (move: string) => void,
) {
  const [selection, setSelection] = useState<{
    fen: string;
    square: string;
  } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;
  const move = (from: string, to: string) => {
    const choices = legalMoves.filter((uci) => uci.startsWith(from + to));
    if (choices.length === 0) return false;
    setSelection(null);
    play?.(choices.length === 1 ? (choices[0] ?? "") : from + to);
    return true;
  };
  const choose = (square: string) => {
    if (selected && move(selected, square)) return;
    setSelection(
      selected !== square && legalMoves.some((uci) => uci.startsWith(square))
        ? { fen, square }
        : null,
    );
  };
  return { selected, choose, move, clear: () => setSelection(null) };
}

export function BoardInput({
  fen,
  reversed,
  selected,
  choose,
  clear,
  disabled,
}: {
  fen: string;
  reversed: boolean;
  selected: string | null;
  choose: (square: string) => void;
  clear: () => void;
  disabled: boolean;
}) {
  const help = useId();
  const [focusSquare, setFocusSquare] = useState(reversed ? "h1" : "a8");
  const squares = Array.from(reversed ? "12345678" : "87654321").flatMap(
    (rank) =>
      Array.from(reversed ? "hgfedcba" : "abcdefgh", (file) => file + rank),
  );
  const pieces = fenStringToPositionObject(fen, 8, 8);
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Escape") clear();
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[
      event.key
    ];
    if (offset === undefined) return;
    event.preventDefault();
    const next = index + offset;
    if (
      next < 0 ||
      next >= 64 ||
      (Math.abs(offset) === 1 && next >> 3 !== index >> 3)
    )
      return;
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll("button");
    buttons?.item(next)?.focus();
  };
  return (
    <div
      data-board-input
      role="group"
      aria-label="Play on board"
      aria-describedby={help}
      className="board-input"
    >
      <span className="visually-hidden" id={help}>
        Use arrow keys to move across squares. Press Enter or Space to pick up
        or place a piece.
      </span>
      {squares.map((square, index) => {
        const piece = pieces[square]?.pieceType;
        const description = piece
          ? `${piece[0] === "w" ? "White" : "Black"} ${pieceNames[piece[1] ?? ""]}`
          : "Empty";
        return (
          <button
            key={square}
            type="button"
            tabIndex={square === focusSquare ? 0 : -1}
            aria-pressed={square === selected}
            aria-disabled={disabled}
            aria-label={`${square}, ${description}`}
            onFocus={() => setFocusSquare(square)}
            onKeyDown={(event) => navigate(event, index)}
            onClick={() => choose(square)}
          />
        );
      })}
    </div>
  );
}
