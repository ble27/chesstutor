import type { components } from "../../api/generated";
import type { Game } from "../../api/discoveryValidation";
import { CLASSIFICATION_LABELS, summaryColumn } from "./summaryPresentation";

type Summary = components["schemas"]["ClassificationSummary"];
type Review = components["schemas"]["ReviewedMove"];
type Props = {
  summary: Summary;
  reviews?: readonly Review[] | undefined;
  players?: Pick<Game["game"], "white" | "black">;
};

export function ClassificationSummary({ summary, reviews, players }: Props) {
  const columns = (["white", "black"] as const).map((color) =>
    summaryColumn(
      summary.players[color],
      reviews?.filter((move) => move.mover === color),
    ),
  );
  return (
    <section
      aria-label="Classification summary"
      className="classification-summary"
    >
      <h3>
        {summary.is_final
          ? "Game summary"
          : "Summary so far · analysis incomplete"}
      </h3>
      <ClassificationTable columns={columns} players={players} />
      <details className="summary-method">
        <summary>How these numbers work</summary>
        <p>
          Chess Tutor accuracy = 100 × (1 − average expected-score loss), using
          scored plies only. Unclassified plies are excluded. This independent
          metric is not Chess.com accuracy.
        </p>
        <p>
          One primary label per ply: Brilliant, then Great, then Miss, otherwise
          the base label. Brilliance is heuristic. Quick results may change
          after Deep analysis.
        </p>
      </details>
      {summary.critical_moments.map((moment) => (
        <p key={moment.ply}>
          Critical moment: ply {moment.ply} · {moment.mover} · {moment.label}
        </p>
      ))}
      {summary.practice_themes.map((theme) => (
        <p key={theme.name}>
          Practice: {theme.name} · plies {theme.supporting_plies.join(", ")}
        </p>
      ))}
    </section>
  );
}

function ClassificationTable({
  columns,
  players,
}: {
  columns: ReturnType<typeof summaryColumn>[];
  players: Props["players"];
}) {
  return (
    <table
      className="classification-table"
      aria-label="Move classifications by player"
    >
      <thead>
        <tr>
          <th scope="col">Move quality</th>
          {(["white", "black"] as const).map((color) => (
            <th key={color} scope="col">
              {players && (
                <span className="summary-player">
                  {players[color].username}
                </span>
              )}
              {color === "white" ? "White" : "Black"}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="summary-accuracy">
          <th scope="row">Chess Tutor accuracy</th>
          {columns.map((column, index) => (
            <td
              key={index}
              className={
                column.accuracy === "Unavailable"
                  ? "accuracy-unavailable"
                  : undefined
              }
            >
              {column.accuracy}
            </td>
          ))}
        </tr>
        {CLASSIFICATION_LABELS.map(([key, label]) => (
          <tr key={key}>
            <th scope="row">
              <span
                className={`classification-dot label-${key}`}
                aria-hidden="true"
              />
              {label}
            </th>
            {columns.map((column, index) => (
              <td key={index}>{column.counts[key] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total reviewed plies</th>
          {columns.map((column, i) => (
            <td key={i}>{column.total}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">Scored plies</th>
          {columns.map((column, i) => (
            <td key={i}>{column.scored}</td>
          ))}
        </tr>
        <tr>
          <th scope="row">Average expected-score loss</th>
          {columns.map((column, i) => (
            <td key={i}>{column.average}</td>
          ))}
        </tr>
      </tfoot>
    </table>
  );
}
