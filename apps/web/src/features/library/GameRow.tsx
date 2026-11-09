import type { Game, Summary } from "../../api/discoveryValidation";
import { gameOutcome, moveCount } from "./gamePresentation";
import { TimeControl } from "./TimeControl";

const unavailable = {
  unsupported_game: "Unsupported variant",
  unfinished_game: "Unfinished or inconsistent result",
  invalid_data: "Missing PGN",
  game_too_large: "PGN exceeds 1 MiB",
};

export function GameRow({
  game,
  opened,
  open,
}: {
  game: Summary;
  opened: Game | null;
  open: (id: string) => void;
}) {
  const selected = opened?.game.id === game.id;
  const outcome = gameOutcome(game);
  const moves = selected && opened ? moveCount(opened) : game.move_count;
  return (
    <li className={`game-row${selected ? " is-open" : ""}`}>
      <div className="game-when">
        <TimeControl value={game.time_class} />
        {game.end_time ? (
          <time dateTime={game.end_time}>
            {new Date(game.end_time).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        ) : (
          <span>Date unavailable</span>
        )}
      </div>
      <div className="game-players">
        <span>
          <i className="piece-color white" aria-hidden="true" />
          <span>White: {game.white.username}</span>
          <small>{game.white.rating ?? "Unrated"}</small>
        </span>
        <span>
          <i className="piece-color black" aria-hidden="true" />
          <span>Black: {game.black.username}</span>
          <small>{game.black.rating ?? "Unrated"}</small>
        </span>
      </div>
      <div className="game-result" aria-label="Game summary">
        <strong>{outcome.score}</strong>
        <span>{outcome.description}</span>
        <small>
          {moves != null
            ? `${moves} ${moves === 1 ? "move" : "moves"}`
            : "Move count unavailable"}
          {selected &&
            opened &&
            ` · ${opened.positions.length - 1} ${opened.positions.length === 2 ? "ply" : "plies"}`}
        </small>
      </div>
      <div className="game-row-actions">
        {game.eligibility === "available" ? (
          <button aria-pressed={selected} onClick={() => open(game.id)}>
            {selected ? "Reopen game" : "Open game"}
          </button>
        ) : (
          <span>{unavailable[game.eligibility]}</span>
        )}
        <a href={game.source_url} target="_blank" rel="noreferrer">
          View on Chess.com{" "}
          <img
            src="/icons/lucide/external-link.svg"
            width="12"
            height="12"
            alt=""
          />
        </a>
      </div>
    </li>
  );
}
