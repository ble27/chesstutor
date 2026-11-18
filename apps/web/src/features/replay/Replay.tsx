import { useReviewPosition } from "./useReviewPosition";
import { formatScore } from "../review/EngineEvidence";
import type { Game } from "../../api/discoveryValidation";
import { replayKeyDown } from "./useReplay";
import { ReviewWorkspace } from "../review/ReviewWorkspace";
import { BoardFrame } from "./BoardFrame";
import { PositionText } from "./PositionText";
import type { BoardArrow } from "../guidance/arrows";

export function Replay({
  game,
  automatic = false,
}: {
  game: Game;
  automatic?: boolean;
}) {
  return (
    <ReplaySession
      key={`${game.game.id}:${game.version}:${game.pgn_hash}`}
      game={game}
      automatic={automatic}
    />
  );
}

function ReplaySession({
  game,
  automatic,
}: {
  game: Game;
  automatic: boolean;
}) {
  const view = useReviewPosition(game);
  const {
    replay,
    variation,
    local,
    boardPosition,
    selectedMove,
    preview,
    setArrows,
  } = view;
  const { selectedPly } = replay;
  const lastPly = game.positions.length - 1;
  if (!boardPosition) return null;
  return (
    <section
      id="review-workspace"
      className="workspace replay-workspace"
      aria-label="Game replay"
      aria-describedby="replay-help"
      tabIndex={0}
      onKeyDown={(event) =>
        replayKeyDown(
          event,
          local.sandbox.enabled
            ? local.sandbox.branch.length
            : variation.kind === "variation"
              ? variation.step
              : selectedPly,
          local.sandbox.enabled
            ? local.sandbox.branch.length + local.sandbox.future.length
            : variation.kind === "variation"
              ? variation.length
              : lastPly,
          local.sandbox.enabled
            ? local.sandbox.seek
            : variation.kind === "variation"
              ? variation.select
              : view.select,
        )
      }
    >
      <ReplayBoard
        game={game}
        selectedMove={selectedMove}
        fen={boardPosition.fen}
        orientation={variation.orientation}
        lastMove={preview ? null : boardPosition.uci}
        arrows={view.arrows}
        localScore={
          local.live.line && (local.refine || local.sandbox.enabled)
            ? formatScore(local.live.line.score, 2)
            : null
        }
        onMove={
          local.sandbox.enabled && !local.sandbox.busy ? local.play : undefined
        }
        legalMoves={local.sandbox.position?.legal_moves}
      />
      <ReviewWorkspace
        automatic={automatic}
        game={game}
        selectedPly={selectedPly}
        positionPly={view.positionPly}
        coachArrows={view.coachArrows}
        selectPosition={view.selectPosition}
        select={view.select}
        localAnalysis={local}
        flip={variation.flip}
        variation={variation}
        onArrows={setArrows}
      />
    </section>
  );
}

function PieceCredit() {
  return (
    <p className="piece-credit">
      Pieces:{" "}
      <a href="/pieces/classic/README.md" target="_blank" rel="noreferrer">
        Classic Merida · Armando Hernandez Marroquin
      </a>{" "}
      ·{" "}
      <a href="/pieces/classic/LICENSE.txt" target="_blank" rel="noreferrer">
        GPL-2.0-or-later
      </a>
    </p>
  );
}

function ReplayBoard({
  game,
  selectedMove,
  fen,
  orientation,
  lastMove,
  arrows,
  localScore,
  onMove,
  legalMoves,
}: {
  game: Game;
  selectedMove: string;
  fen: string;
  orientation: "white" | "black";
  lastMove: string | null;
  arrows: BoardArrow[];
  localScore: string | null;
  onMove?: ((move: string) => void) | undefined;
  legalMoves?: readonly string[] | undefined;
}) {
  return (
    <section className="panel replay-panel" aria-labelledby="game-title">
      <h2 id="game-title" className="visually-hidden">
        Replay both sides
      </h2>
      <p
        role="status"
        aria-label="Replay position"
        aria-atomic="true"
        className="replay-position"
      >
        {selectedMove} · {fen.split(" ")[1] === "w" ? "White" : "Black"} to move
        · {orientation === "white" ? "White" : "Black"} at bottom
      </p>
      {localScore && (
        <p role="status">
          Local evaluation: {localScore} · White perspective · Client-unverified
        </p>
      )}
      <BoardFrame
        players={game.game}
        fen={fen}
        orientation={orientation}
        lastMove={lastMove}
        arrows={arrows}
        onMove={onMove}
        legalMoves={legalMoves}
      />
      <PositionText fen={fen} />
      <PieceCredit />
    </section>
  );
}
