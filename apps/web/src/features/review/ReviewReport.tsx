import type { Analysis } from "../../api/analysis";
import type { Game } from "../../api/discoveryValidation";
import { MoveList } from "../replay/MoveList";
import { CLASSIFICATION_LABELS, moveRating } from "./summaryPresentation";
import "./reviewReport.css";

const sides = ["white", "black"] as const;
type Side = (typeof sides)[number];
type Count = { total: number; ratings: Map<string, number> };

function countsBySide(
  game: Game,
  reviews: NonNullable<Analysis["classifications"]>,
) {
  const counts: Record<Side, Count> = {
    white: { total: 0, ratings: new Map() },
    black: { total: 0, ratings: new Map() },
  };
  const byPly = new Map(reviews.map((review) => [review.ply, review]));
  for (const move of game.positions.slice(1)) {
    const fen = game.positions[move.ply - 1]?.fen;
    if (!fen) continue;
    const side = fen.split(" ")[1] === "b" ? "black" : "white";
    const { kind } = moveRating(byPly.get(move.ply));
    const count = counts[side];
    count.total += 1;
    count.ratings.set(kind, (count.ratings.get(kind) ?? 0) + 1);
  }
  return counts;
}

function ClassificationTotals({ counts }: { counts: Record<Side, Count> }) {
  const labels = [
    ...CLASSIFICATION_LABELS.filter(([kind]) => kind !== "unclassified"),
    ["unclassified", "Review needed"],
    ["pending", "Awaiting analysis"],
  ] as const;
  return (
    <table className="report-totals" aria-label="Classification totals">
      <thead>
        <tr>
          <th scope="col">Classification</th>
          <th scope="col">White</th>
          <th scope="col">Black</th>
        </tr>
      </thead>
      <tbody>
        {labels.map(([kind, label]) => {
          const white = counts.white.ratings.get(kind) ?? 0;
          const black = counts.black.ratings.get(kind) ?? 0;
          if (
            (kind === "pending" || kind === "unclassified") &&
            white + black === 0
          )
            return null;
          return (
            <tr key={kind}>
              <th scope="row" data-rating={kind}>
                {label}
              </th>
              <td>{white}</td>
              <td>{black}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total plies</th>
          <td>{counts.white.total}</td>
          <td>{counts.black.total}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function ReviewReport({
  game,
  selectedPly,
  select,
  analysis,
}: {
  game: Game;
  selectedPly: number;
  select: (ply: number) => void;
  analysis: Analysis | null;
}) {
  const reviews = analysis?.classifications ?? [];
  return (
    <section className="panel moves-module" aria-label="Move report">
      <div className="module-heading">
        <h2>Report</h2>
        <span className="report-ply-total">
          {game.positions.length - 1} plies
        </span>
      </div>
      <AccuracyReadout analysis={analysis} />
      <ClassificationTotals counts={countsBySide(game, reviews)} />
      <details className="report-moves" open>
        <summary>Move report</summary>
        <div className="move-columns" aria-hidden="true">
          <span>#</span>
          <span>White</span>
          <span>Black</span>
        </div>
        <MoveList
          game={game}
          selectedPly={selectedPly}
          select={select}
          reviews={reviews}
        />
      </details>
    </section>
  );
}

function AccuracyReadout({ analysis }: { analysis: Analysis | null }) {
  const accuracy = analysis?.accuracy;
  if (!accuracy) return null;
  const players = accuracy.players;
  return (
    <div className="accuracy-readout" aria-label="Accuracy">
      <span>Accuracy</span>
      {sides.map((color) => {
        const item = players[color];
        if (!item) return null;
        return (
          <span key={color}>
            <i className={`piece-color ${color}`} aria-hidden="true" />
            <span className="visually-hidden">{color} </span>
            {item.accuracy == null ? "—" : `${item.accuracy.toFixed(1)}%`}
            <span
              className="accuracy-coverage"
              aria-label={`${item.scored_plies} of ${item.total_plies} scored plies`}
            >
              {item.scored_plies}/{item.total_plies}
            </span>
          </span>
        );
      })}
    </div>
  );
}
