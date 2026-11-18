import { useEffect, useRef, useState } from "react";
import type { ApiError } from "./api/client";
import { useDiscovery } from "./useDiscovery";
import { Replay } from "./features/replay/Replay";
import { GameRow } from "./features/library/GameRow";
import { PlayerRatings } from "./features/library/PlayerRatings";
import { LibraryFilters } from "./features/library/LibraryFilters";

function Failure({ error }: { error: ApiError }) {
  return (
    <p role="alert">
      {error.message}
      {error.retryAfterSeconds != null &&
        ` Try again in ${error.retryAfterSeconds} seconds.`}
    </p>
  );
}
export function Discovery() {
  const state = useDiscovery();
  const [username, setUsername] = useState("");
  const [reviewOpen, setReviewOpen] = useState(true);
  const wasReviewing = useRef(false);
  const game =
    state.game.status === "ready" && reviewOpen ? state.game.data : null;
  useEffect(() => {
    document.body.classList.toggle("review-active", game !== null);
    return () => document.body.classList.remove("review-active");
  }, [game]);
  useEffect(() => {
    if (game) {
      if (window.scrollY > 0) window.scrollTo({ top: 0 });
      document
        .getElementById("review-workspace")
        ?.focus({ preventScroll: true });
    } else if (wasReviewing.current) {
      document
        .querySelector<HTMLButtonElement>(".game-row.is-open button")
        ?.focus();
    }
    wasReviewing.current = game !== null;
  }, [game]);
  if (game) {
    return (
      <>
        <header className="review-heading">
          <button onClick={() => setReviewOpen(false)}>Back to library</button>
          <h1>Game review</h1>
          <span className="game-score">{game.result.replace("-", "–")}</span>
        </header>
        <Replay game={game} automatic />
      </>
    );
  }
  return (
    <div className="library-shell">
      <form
        className="panel search library-search"
        aria-label="Find games"
        onSubmit={(event) => {
          event.preventDefault();
          void state.search(username);
        }}
      >
        <label>
          Chess.com username
          <input
            required
            minLength={3}
            maxLength={25}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <button>Find games</button>
      </form>
      {state.archive.status !== "idle" && (
        <section className="panel game-library" aria-labelledby="library-title">
          <h2 id="library-title" className="library-title">
            Games
          </h2>
          <ArchiveControls state={state} />
          <GameResults state={state} onOpen={() => setReviewOpen(true)} />
          {state.game.status === "loading" && (
            <p role="status">Loading game…</p>
          )}
          {state.game.status === "error" && (
            <Failure error={state.game.error} />
          )}
        </section>
      )}
    </div>
  );
}

type DiscoveryState = ReturnType<typeof useDiscovery>;

function ArchiveControls({ state }: { state: DiscoveryState }) {
  return (
    <>
      {state.archive.status === "loading" && (
        <p aria-live="polite">Looking up public archives…</p>
      )}
      {state.archive.status === "error" && (
        <Failure error={state.archive.error} />
      )}
      {state.archive.status === "ready" && (
        <>
          {state.archive.data.stale && state.list.status !== "ready" && (
            <p className="freshness">Cached archive</p>
          )}
          <PlayerRatings
            key={state.archive.data.username}
            username={state.archive.data.username}
          />
          {state.archive.data.months.length === 0 ? (
            <p>No public games are available for this player.</p>
          ) : (
            <>
              <LibraryFilters
                month={state.month}
                months={state.archive.data.months}
                filters={state.filters}
                apply={(month, filters) => void state.select(month, filters)}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

function GameResults({
  state,
  onOpen,
}: {
  state: DiscoveryState;
  onOpen: () => void;
}) {
  return (
    <>
      {state.list.status === "loading" && (
        <p aria-live="polite">Loading monthly games…</p>
      )}
      {state.list.status === "error" && (
        <>
          <Failure error={state.list.error} />
          <button onClick={() => void state.select(state.month, state.filters)}>
            Retry month
          </button>
        </>
      )}
      {state.list.status === "ready" && (
        <>
          {(state.list.data.stale ||
            (state.archive.status === "ready" && state.archive.data.stale)) && (
            <p className="freshness">Cached archive</p>
          )}
          {state.list.data.games.length === 0 && (
            <p>No games match this month and these filters.</p>
          )}
          <ul className="game-list" aria-label="Recent games">
            {state.list.data.games.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                opened={state.game.status === "ready" ? state.game.data : null}
                open={(id) => {
                  onOpen();
                  void state.open(id);
                }}
              />
            ))}
          </ul>
          {state.list.data.next_cursor && (
            <button
              onClick={() => {
                if (state.list.status === "ready")
                  void state.select(
                    state.month,
                    state.filters,
                    state.list.data.next_cursor,
                  );
              }}
            >
              Next page
            </button>
          )}
        </>
      )}
    </>
  );
}
