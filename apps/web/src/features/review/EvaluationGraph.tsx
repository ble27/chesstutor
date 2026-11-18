import type { Game } from "../../api/discoveryValidation";
import type { EvaluationPoint } from "./evaluationSeries";
import type { Evidence } from "../../api/analysisEvidence";
import {
  evaluationSeries,
  graphSegments,
  smoothPath,
} from "./evaluationSeries";
export function EvaluationGraph({
  game,
  evidence,
  selectedPly,
  select,
  reviews,
}: {
  game: Game;
  evidence: readonly Evidence[];
  selectedPly: number;
  select: (ply: number) => void;
  reviews?:
    | readonly { ply: number; classification: { base_label: string } }[]
    | undefined;
}) {
  const series = evaluationSeries(game, evidence);
  const last = game.positions.length - 1;
  return (
    <section
      className="panel evaluation-graph"
      aria-label="Game evaluation graph"
    >
      <div className="module-heading">
        <h2>Evaluation history</h2>
      </div>
      <div className="graph-track">
        <GraphCanvas
          series={series}
          selectedPly={selectedPly}
          reviews={reviews}
        />
        <input
          type="range"
          min={0}
          max={last}
          value={selectedPly}
          onChange={(event) => select(Number(event.target.value))}
          aria-label="Position on graph"
          aria-valuetext={`Ply ${selectedPly}: ${series[selectedPly]?.label ?? "evaluation pending"}, White perspective`}
        />
      </div>
    </section>
  );
}

type Marker = { ply: number; classification: { base_label: string } };
function GraphCanvas({
  series,
  selectedPly,
  reviews,
}: {
  series: (EvaluationPoint | null)[];
  selectedPly: number;
  reviews: readonly Marker[] | undefined;
}) {
  const last = series.length - 1;
  return (
    <svg
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="White advantage above the centre; Black advantage below. Missing evidence leaves gaps."
    >
      <path d="M0,50H1000" stroke="#8f9693" strokeWidth="1" />
      {graphSegments(series).map((points, index) => {
        const first = points[0],
          final = points[points.length - 1];
        if (!first || !final) return null;
        const path = smoothPath(points, last);
        const start = (first.ply / Math.max(1, last)) * 1000,
          end = (final.ply / Math.max(1, last)) * 1000;
        return (
          <g key={index}>
            <path
              d={`${path} L${end},100 L${start},100Z`}
              fill="#f0e6d6"
              opacity="0.9"
            />
            <path d={`${path} L${end},0 L${start},0Z`} fill="#424b42" />
            <path
              d={path}
              fill="none"
              stroke="#ACC65B"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      <GraphMarkers series={series} reviews={reviews} last={last} />
      <path
        d={`M${(selectedPly / Math.max(1, last)) * 1000},0v100`}
        stroke="#eac96a"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function GraphMarkers({
  series,
  reviews,
  last,
}: {
  series: (EvaluationPoint | null)[];
  reviews: readonly Marker[] | undefined;
  last: number;
}) {
  const colors: Record<string, string> = {
    blunder: "#f18d82",
    mistake: "#efa362",
    miss: "#e4bc72",
    best: "#ACC65B",
    inaccuracy: "#eac96a",
  };
  return (
    <>
      {reviews?.map((review) => {
        const point = series[review.ply];
        return point ? (
          <circle
            key={review.ply}
            cx={(review.ply / Math.max(1, last)) * 1000}
            cy={50 - point.advantage * 45}
            r="4"
            fill={colors[review.classification.base_label] ?? "#ddd"}
          >
            <title>
              Ply {review.ply}: {review.classification.base_label},{" "}
              {point.label}
            </title>
          </circle>
        ) : null;
      })}
    </>
  );
}
