import { useEffect, useRef } from "react";
import type { Game } from "../../api/discoveryValidation";
import { moveLabel } from "./moves";

type Move = Game["positions"][number];
type Row = { number: number; white?: Move; black?: Move };

function moveRows(positions: Game["positions"]): Row[] {
  const rows: Row[] = [];
  for (const move of positions.slice(1)) {
    const previous = positions[move.ply - 1];
    if (!previous) continue;
    const fields = previous.fen.split(" ");
    const number = Number(fields[5]);
    const color = fields[1] === "w" ? "white" : "black";
    let row = rows.at(-1);
    if (row?.number !== number) {
      row = { number };
      rows.push(row);
    }
    row[color] = move;
  }
  return rows;
}

export function MoveList({
  game,
  selectedPly,
  select,
}: {
  game: Game;
  selectedPly: number;
  select: (ply: number) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const container = list.current;
    const selected = container?.querySelector('[aria-current="step"]');
    if (!container || !selected) return;
    const bounds = container.getBoundingClientRect();
    const move = selected.getBoundingClientRect();
    // Scroll only the move list; navigating must not pull the board off-screen.
    if (move.top < bounds.top || move.bottom > bounds.bottom)
      container.scrollTop += move.top - bounds.top - container.clientHeight / 2;
  }, [selectedPly]);
  return (
    <ol ref={list} className="move-list" aria-label="Game moves">
      {moveRows(game.positions).map((row) => (
        <li key={row.number}>
          <span aria-hidden="true">{row.number}.</span>
          {(["white", "black"] as const).map((color) => {
            const move = row[color];
            return move ? (
              <button
                key={color}
                aria-label={moveLabel(
                  game.positions[move.ply - 1]?.fen ?? "",
                  move.san,
                )}
                aria-current={selectedPly === move.ply ? "step" : undefined}
                onClick={() => select(move.ply)}
              >
                {move.san}
              </button>
            ) : (
              <span key={color} aria-label={`No ${color} move`}>
                —
              </span>
            );
          })}
        </li>
      ))}
    </ol>
  );
}
