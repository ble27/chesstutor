import { useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { BoardArrow } from "../guidance/arrows";
import { useVariation } from "../review/useVariation";
import { useReplay } from "./useReplay";
import { moveLabel } from "./moves";
import type { LocalAnalysis } from "../analysis/useLocalAnalysis";
import { useLocalAnalysis } from "../analysis/useLocalAnalysis";
export function useReviewPosition(game: Game) {
  const replay = useReplay(game.positions.length - 1);
  const [arrows, setArrows] = useState<BoardArrow[]>([]);
  const [coachArrowsVisible, setCoachArrowsVisible] = useState(true);
  const position = game.positions[replay.selectedPly];
  const variation = useVariation({
    selectedPly: replay.selectedPly,
    fen: position?.fen ?? "",
    orientation: replay.orientation,
  });
  const local = useLocalAnalysis(game, replay.selectedPly);
  const previous = game.positions[replay.selectedPly - 1];
  const preview =
    !local.sandbox.enabled &&
    !local.refine &&
    variation.kind === "game" &&
    arrows.length > 0 &&
    previous &&
    arrows.every(
      (a) => a.ply === replay.selectedPly && a.rootFen === previous.fen,
    );
  const sandboxRoot = game.positions[local.sandbox.root ?? replay.selectedPly];
  const refineRoot = game.positions[local.refineRoot ?? replay.selectedPly];
  const boardPosition =
    local.sandbox.enabled && sandboxRoot
      ? {
          fen: local.sandbox.position?.fen ?? sandboxRoot.fen,
          uci: local.sandbox.branch.at(-1) ?? sandboxRoot.uci,
        }
      : local.refine && refineRoot
        ? { fen: local.position?.fen ?? refineRoot.fen, uci: refineRoot.uci }
        : variation.kind === "variation"
          ? { fen: variation.fen, uci: variation.lastMove }
          : preview
            ? previous
            : position;
  const positionPly = local.refine
    ? (local.refineRoot ?? replay.selectedPly)
    : preview
      ? replay.selectedPly - 1
      : replay.selectedPly;
  const selectedMove = local.sandbox.enabled
    ? `Free analysis · root ply ${local.sandbox.root} · branch ply ${local.sandbox.branch.length}`
    : local.refine
      ? `Local refinement · position ply ${local.refineRoot}`
      : variation.kind === "variation"
        ? `Variation from ply ${variation.rootPly} · ${variation.step} of ${variation.length}${variation.san ? ` · ${variation.san}` : ""}`
        : recordedDescription(game, replay.selectedPly, Boolean(preview));
  const liveArrows = suggestionArrows(
    local,
    boardPosition?.fen,
    replay.selectedPly,
  );
  const select = (ply: number) => {
    variation.exit();
    local.sandbox.exit();
    local.setRefine(false);
    replay.select(ply);
  };
  return {
    replay,
    variation,
    local,
    boardPosition,
    positionPly,
    selectedMove,
    preview,
    setArrows,
    arrows: preview ? arrows : liveArrows,
    select,
    coachArrows: {
      visible: coachArrowsVisible,
      setVisible: setCoachArrowsVisible,
    },
    selectPosition: (ply: number) => {
      setCoachArrowsVisible(false);
      select(ply);
    },
  };
}

function recordedDescription(game: Game, ply: number, before: boolean): string {
  const previous = game.positions[ply - 1];
  return previous
    ? `${before ? "Before" : "After"} ${moveLabel(previous.fen, game.positions[ply]?.san ?? null)}`
    : "Starting position";
}

function suggestionArrows(
  local: LocalAnalysis,
  fen: string | undefined,
  ply: number,
): BoardArrow[] {
  const first = local.live.line?.pv[0]?.uci;
  if (
    !first ||
    !fen ||
    !local.suggestions ||
    (!local.refine && !local.sandbox.enabled)
  )
    return [];
  return [
    {
      startSquare: first.slice(0, 2),
      endSquare: first.slice(2, 4),
      color: "#ACC65B",
      rootFen: fen,
      ply,
    },
  ];
}
