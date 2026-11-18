import { useId } from "react";
import type { Game } from "../../api/discoveryValidation";
import { moveLabel } from "./moves";
import type { Analysis } from "../../api/analysis";
import { moveRating } from "../review/summaryPresentation";

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
  const id = useId();
  const byPly = new Map(reviews?.map((review) => [review.ply, review]));
  return (
    <ol className="move-list" aria-label="Game moves">
      {moveRows(game.positions).map((row) => (
        <li key={row.number}>
          <span aria-hidden="true">{row.number}.</span>
          {(["white", "black"] as const).map((color) => {
            const move = row[color];
            const rating = moveRating(move ? byPly.get(move.ply) : undefined);
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
                    data-rating={rating.kind}
                    id={`${id}-classification-${move.ply}`}
                  >
                    {rating.name}
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
