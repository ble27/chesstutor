import { useEffect, useState } from "react";
import type { ApiError } from "./api/client";
import { useDiscovery } from "./useDiscovery";
import { Workspace } from "./Workspace";
import { GameRow } from "./features/library/GameRow";
import { PlayerRatings } from "./features/library/PlayerRatings";
import { LibraryFilters } from "./features/library/LibraryFilters";
import { moveCount } from "./features/library/gamePresentation";

function Failure({ error }: { error: ApiError }) {
  return (
    <p role="alert">
      {error.message}
      {error.retryAfterSeconds != null &&
        ` Try again in ${error.retryAfterSeconds} seconds.`}
    </p>
  );
}
function Freshness({ date, stale }: { date: string; stale: boolean }) {
  return (
    <p className="freshness">
      {stale
        ? "Stale cached data — Chess.com could not be refreshed."
        : "Public archive data"}{" "}
      · Fetched <time dateTime={date}>{new Date(date).toLocaleString()}</time>
    </p>
  );
}
export function Discovery() {
  const state = useDiscovery();
  const [username, setUsername] = useState("");
  const [reviewOpen, setReviewOpen] = useState(true);
  const game =
    state.game.status === "ready" && reviewOpen ? state.game.data : null;
  useEffect(() => {
    document.body.classList.toggle("review-active", game !== null);
    return () => document.body.classList.remove("review-active");
  }, [game]);
  return (
    <>
      {game && (
        <header className="review-heading">
          <button onClick={() => setReviewOpen(false)}>Back to library</button>
          <h1>Game Review</h1>
          <span>
            {game.game.white.username} · {game.game.black.username}
          </span>
        </header>
      )}
      <section className="panel discovery" aria-labelledby="discovery-title">
        <h2 id="discovery-title">Find your next game to learn from.</h2>
        <p>Enter a Chess.com username to explore their public game history.</p>
        <form
          className="search"
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
              placeholder="e.g. your Chess.com username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <button>Find games</button>
        </form>
        <details className="import-limits">
          <summary>Supported games and import limits</summary>
          <p>
            Completed standard chess only. Import limits: 300 plies, 1 MiB per
            PGN, 50 MiB per monthly archive.
          </p>
        </details>
      </section>
      <section className="panel game-library" aria-labelledby="library-title">
        <div className="library-heading">
          <div>
            <h2 id="library-title">Game library</h2>
            <p>Recent games, ready for a closer look.</p>
          </div>
        </div>
        <ArchiveControls state={state} />
        <GameResults state={state} onOpen={() => setReviewOpen(true)} />
        <ImportedGame state={state} />
      </section>
      <Workspace game={game} />
    </>
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
          {(state.list.status !== "ready" || state.archive.data.stale) && (
            <Freshness
              date={state.archive.data.fetched_at}
              stale={state.archive.data.stale}
            />
          )}
          <PlayerRatings
            key={state.archive.data.username}
            username={state.archive.data.username}
          />
          {state.archive.data.months.length === 0 ? (
            <p>No public games are available for this player.</p>
          ) : (
            <>
              <label>
                Archive month
                <select
                  value={state.month}
                  onChange={(event) =>
                    void state.select(event.target.value, state.filters)
                  }
                >
                  {state.archive.data.months.map((month) => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </label>
              <p className="library-caption">
                Newest first · 20 per page · Filters cover the selected month.
              </p>
              <LibraryFilters
                filters={state.filters}
                apply={(filters) => void state.select(state.month, filters)}
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
      {state.list.status === "idle" && state.archive.status === "idle" && (
        <p className="library-empty">
          Search a player to load their recent games. Pick a game to replay both
          sides and inspect its analysis.
        </p>
      )}
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
          <Freshness
            date={state.list.data.fetched_at}
            stale={state.list.data.stale}
          />
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

function ImportedGame({ state }: { state: DiscoveryState }) {
  useEffect(() => {
    if (state.game.status !== "ready") return;
    const workspace = document.getElementById("review-workspace");
    workspace?.scrollIntoView?.({ block: "start" });
    workspace?.focus({ preventScroll: true });
  }, [state.game]);
  return (
    <>
      {state.game.status === "loading" && (
        <p aria-live="polite">Validating and importing game…</p>
      )}
      {state.game.status === "error" && <Failure error={state.game.error} />}
      {state.game.status === "ready" && (
        <section className="imported" aria-labelledby="imported-title">
          <h3 id="imported-title">Game imported</h3>
          <p>
            {state.game.data.game.white.username} vs{" "}
            {state.game.data.game.black.username} · {state.game.data.result} ·{" "}
            {moveCount(state.game.data)}{" "}
            {moveCount(state.game.data) === 1 ? "move" : "moves"} ·{" "}
            {state.game.data.positions.length - 1}{" "}
            {state.game.data.positions.length === 2 ? "ply" : "plies"}
          </p>
          <a className="review-link" href="#review-workspace">
            Go to game review
          </a>
          <p>
            Every main-line move was validated. Replay both players’ moves
            below.
          </p>
        </section>
      )}
    </>
  );
}
