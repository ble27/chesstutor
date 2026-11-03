import type { components } from "./generated";
import { array, color, flag, integer, object, text } from "./analysisFields";
import { positionFen, validateMove } from "./replayValidation";

type Schemas = components["schemas"];
type Score = Schemas["CentipawnScore"] | Schemas["MateScore"];
type Line = Schemas["EngineLine"];
export type Evidence = Schemas["MoveEvidence"];

function score(input: unknown): Score {
  const value = object(input),
    pov = color(value.pov);
  if (value.kind === "cp")
    return {
      kind: "cp",
      centipawns: integer(value.centipawns, -1000000, 1000000),
      pov,
    };
  if (value.kind === "mate")
    return {
      kind: "mate",
      moves: integer(value.moves, -1000000, 1000000),
      pov,
    };
  throw new Error("Invalid score");
}
function line(input: unknown): Line {
  const value = object(input);
  const white = score(value.score),
    mover = score(value.mover_score);
  if (white.pov !== "white") throw new Error("Expected White score POV");
  const raw = value.wdl === null ? null : object(value.wdl);
  const wdl =
    raw === null
      ? null
      : {
          wins: integer(raw.wins, 0, 1000),
          draws: integer(raw.draws, 0, 1000),
          losses: integer(raw.losses, 0, 1000),
          pov: color(raw.pov),
        };
  if (wdl && wdl.wins + wdl.draws + wdl.losses !== 1000)
    throw new Error("Invalid WDL");
  const pv = array(value.pv, 300).map((item) => {
    const step = object(item),
      san = text(step.san, 32),
      uci = text(step.uci, 5);
    validateMove(1, san, uci);
    return { san, uci, fen: positionFen(text(step.fen)) };
  });
  if (!pv.length) throw new Error("Missing PV");
  return {
    score: white,
    mover_score: mover,
    wdl,
    pv,
    bounded: flag(value.bounded),
    depth: integer(value.depth, 1, 1000),
    nodes: integer(value.nodes, 1),
    time_ms: integer(value.time_ms, 0, 600000),
  };
}

export function evidence(input: unknown): Evidence {
  const value = object(input),
    ply = integer(value.ply, 1, 300);
  const mover = color(value.mover),
    played = line(value.played);
  const best = array(value.best, 3).map(line);
  const status = value.status;
  if (status !== "usable" && status !== "insufficient" && status !== "unstable")
    throw new Error("Invalid evidence status");
  if (
    !best.length ||
    played.mover_score.pov !== mover ||
    best.some(
      (item) =>
        item.mover_score.pov !== mover || (item.wdl && item.wdl.pov !== mover),
    )
  )
    throw new Error("Invalid mover POV");
  if (played.wdl && played.wdl.pov !== mover)
    throw new Error("Invalid WDL POV");
  const played_uci = text(value.played_uci, 5);
  if (played.pv[0]?.uci !== played_uci) throw new Error("Wrong played root");
  const loss = value.expected_loss;
  if (
    loss !== null &&
    (typeof loss !== "number" || !Number.isFinite(loss) || loss < 0 || loss > 1)
  )
    throw new Error("Invalid loss");
  return {
    ply,
    before_ply: integer(value.before_ply, ply - 1, ply - 1),
    mover,
    root_fen: positionFen(text(value.root_fen)),
    played_uci,
    played,
    best,
    status,
    expected_loss: loss,
    claimable_draw_before: flag(value.claimable_draw_before),
    automatic_result_after:
      value.automatic_result_after === null
        ? null
        : text(value.automatic_result_after, 7),
    automatic_reason_after:
      value.automatic_reason_after === null
        ? null
        : text(value.automatic_reason_after, 100),
  };
}
