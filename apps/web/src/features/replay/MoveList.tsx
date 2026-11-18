import { useEffect, useId, useRef } from "react";
import type { Game } from "../../api/discoveryValidation";
import { moveLabel } from "./moves";
import type { Analysis } from "../../api/analysis";
import {
  CLASSIFICATION_LABELS,
  primaryLabel,
} from "../review/summaryPresentation";

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
  reviews,
}: {
  game: Game;
  selectedPly: number;
  select: (ply: number) => void;
  reviews?: Analysis["classifications"];
}) {
  const list = useRef<HTMLOListElement>(null);
  const id = useId();
  useEffect(() => {
    const container = list.current;
    if (!container) return;
    const reveal = () => revealSelected(container, selectedPly);
    reveal();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reveal);
    observer.observe(container);
    return () => observer.disconnect();
  }, [selectedPly, reviews]);
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
                aria-describedby={
                  reviews ? `${id}-classification-${move.ply}` : undefined
                }
                onClick={() => select(move.ply)}
              >
                {move.san}
                {reviews && (
                  <small
                    className="recorded-move-label"
                    id={`${id}-classification-${move.ply}`}
                  >
                    {classificationName(
                      reviews.find((review) => review.ply === move.ply),
                    )}
                  </small>
                )}
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

function classificationName(
  move: NonNullable<Analysis["classifications"]>[number] | undefined,
): string {
  if (!move) return "Pending";
  return (
    CLASSIFICATION_LABELS.find(([key]) => key === primaryLabel(move))?.[1] ??
    "Unclassified"
  );
}

function revealSelected(
  container: HTMLOListElement,
  selectedPly: number,
): void {
  if (selectedPly === 0) {
    container.scrollTop = 0;
    return;
  }
  const selected = container.querySelector('[aria-current="step"]');
  if (!selected) return;
  const bounds = container.getBoundingClientRect();
  const move = selected.getBoundingClientRect();
  const top = bounds.top + container.clientTop;
  const bottom = top + container.clientHeight;
  // Centre the whole button, including its label, inside the scroll viewport.
  if (move.top < top || move.bottom > bottom)
    container.scrollTop +=
      move.top - top - (container.clientHeight - move.height) / 2;
}
