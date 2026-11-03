import { useId } from "react";
import type { Game } from "../../api/discoveryValidation";
import { Board } from "./Board";

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
}: {
  players: Pick<Game["game"], "white" | "black">;
  fen: string;
  orientation: Color;
  lastMove: string | null;
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
      <Board
        fen={fen}
        orientation={orientation}
        lastMove={lastMove}
        describedBy={`${id}-top ${id}-bottom`}
      />
      <PlayerLabel
        id={`${id}-bottom`}
        player={players[orientation]}
        color={orientation}
        edge="Bottom"
      />
    </div>
  );
}
