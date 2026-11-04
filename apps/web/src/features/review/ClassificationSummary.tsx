import type { components } from "../../api/generated";

type Summary = components["schemas"]["ClassificationSummary"];

function playerText(summary: Summary, color: "white" | "black"): string {
  const player = summary.players[color];
  if (!player) return "No evidence";
  const counts = Object.entries(player.counts)
    .map(([label, count]) => `${label} ${count}`)
    .join(", ");
  const average = player.average_expected_loss;
  return `${counts || "no classified moves"}${average === null ? "" : ` · average expected-score loss ${(average * 100).toFixed(1)}%`}`;
}

export function ClassificationSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-label="Classification summary">
      <p>{summary.is_final ? "Game summary" : "Summary so far"}</p>
      <p>White: {playerText(summary, "white")}</p>
      <p>Black: {playerText(summary, "black")}</p>
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
