import { useId, type ReactNode } from "react";
import type { Game } from "../../api/discoveryValidation";
import { Board } from "./Board";
import type { BoardArrow } from "../guidance/arrows";

type Player = Game["game"]["white"];
type Color = "white" | "black";

function PlayerLabel({
  player,
  color,
  edge,
  id,
}: {
  player: Player;
  color: Color;
  edge: "Top" | "Bottom";
  id: string;
}) {
  return (
    <div className="player-label" role="group" aria-label={`${edge} player`}>
      <span className={`piece-color ${color}`} aria-hidden="true" />
      <div id={id}>
        <strong>{player.username}</strong>
        <span>
          {color === "white" ? "White" : "Black"} pieces
          {player.rating == null ? "" : ` · ${player.rating}`}
        </span>
      </div>
    </div>
  );
}

export function BoardFrame({
  players,
  fen,
  orientation,
  lastMove,
  arrows,
  onMove,
  legalMoves,
  evaluation,
}: {
  players: Pick<Game["game"], "white" | "black">;
  fen: string;
  orientation: Color;
  lastMove: string | null;
  arrows?: BoardArrow[] | undefined;
  onMove?: ((move: string) => void) | undefined;
  evaluation?: ReactNode;
  legalMoves?: readonly string[] | undefined;
}) {
  const id = useId();
  const topColor = orientation === "white" ? "black" : "white";
  return (
    <div className="board-frame">
      <PlayerLabel
        id={`${id}-top`}
        player={players[topColor]}
        color={topColor}
        edge="Top"
      />
      <div className="board-and-evaluation">
        {evaluation}
        <Board
          fen={fen}
          orientation={orientation}
          lastMove={lastMove}
          arrows={arrows}
          onMove={onMove}
          legalMoves={legalMoves}
          describedBy={`${id}-top ${id}-bottom`}
        />
      </div>
      <PlayerLabel
        id={`${id}-bottom`}
        player={players[orientation]}
        color={orientation}
        edge="Bottom"
      />
    </div>
  );
}
