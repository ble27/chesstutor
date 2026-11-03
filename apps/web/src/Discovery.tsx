import { useState } from "react";
import type { ApiError } from "./api/client";
import type { Filters } from "./api/discovery";
import type { Summary } from "./api/discoveryValidation";
import { useDiscovery } from "./useDiscovery";

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
function GameCard({
  game,
  open,
}: {
  game: Summary;
  open: (id: string) => void;
}) {
  return (
    <li className="game-card">
      <h3>
        White: {game.white.username} ({game.white.rating ?? "unrated"})<br />
        Black: {game.black.username} ({game.black.rating ?? "unrated"})
      </h3>
      <p>
        White: {game.white.result ?? "result unavailable"} · Black:{" "}
        {game.black.result ?? "result unavailable"}
        <br />
        {game.time_class ?? "time class unavailable"} ·{" "}
        {game.end_time
          ? new Date(game.end_time).toLocaleString()
          : "Date unavailable"}
      </p>
      <a href={game.source_url} target="_blank" rel="noreferrer">
        View on Chess.com ↗
      </a>
      {game.eligibility === "available" ? (
        <button onClick={() => open(game.id)}>Open game</button>
      ) : (
        <p>
          {
            {
              unsupported_game: "Unsupported variant",
              unfinished_game: "Unfinished or inconsistent result",
              invalid_data: "Missing PGN",
              game_too_large: "PGN exceeds 1 MiB",
            }[game.eligibility]
          }
        </p>
      )}
    </li>
  );
}
function FilterForm({
  filters,
  apply,
}: {
  filters: Filters;
  apply: (value: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  return (
    <form
      className="filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply(draft);
      }}
    >
      <label>
        Player color
        <select
          value={draft.color}
          onChange={(event) => {
            const color = event.target.value;
            if (color === "" || color === "white" || color === "black")
              setDraft({ ...draft, color });
          }}
        >
          <option value="">Either</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </label>
      <label>
        Opponent
        <input
          maxLength={25}
          value={draft.opponent}
          onChange={(event) =>
            setDraft({ ...draft, opponent: event.target.value })
          }
        />
      </label>
      <label>
        Time class
        <select
          value={draft.time_class}
          onChange={(event) =>
            setDraft({ ...draft, time_class: event.target.value })
          }
        >
          <option value="">All</option>
          {["bullet", "blitz", "rapid", "daily"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <button>Apply filters</button>
    </form>
  );
}
export function Discovery() {
  const state = useDiscovery();
  const [username, setUsername] = useState("");
  return (
    <section className="panel discovery" aria-labelledby="discovery-title">
      <h2 id="discovery-title">Find a public game</h2>
      <p>
        Completed standard chess only. Import limits: 300 plies, 1 MiB per PGN,
        50 MiB per monthly archive.
      </p>
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
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <button>Find games</button>
      </form>
      <ArchiveControls state={state} />
      <GameResults state={state} />
      <ImportedGame state={state} />
    </section>
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
          <Freshness
            date={state.archive.data.fetched_at}
            stale={state.archive.data.stale}
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
              <p>
                Filters cover the selected month. Games are newest first, 20 per
                page.
              </p>
              <FilterForm
                key={state.archive.data.username}
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

function GameResults({ state }: { state: DiscoveryState }) {
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
          <Freshness
            date={state.list.data.fetched_at}
            stale={state.list.data.stale}
          />
          {state.list.data.games.length === 0 && (
            <p>No games match this month and these filters.</p>
          )}
          <ul className="game-list">
            {state.list.data.games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                open={(id) => void state.open(id)}
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
            {state.game.data.positions.length - 1} plies
          </p>
          <p>
            Every main-line move was validated. Replay is coming in the next
            sprint.
          </p>
          <details>
            <summary>Validated move list</summary>
            <p>
              {state.game.data.positions
                .map((position) => position.san)
                .filter(Boolean)
                .join(" ")}
            </p>
          </details>
        </section>
      )}
    </>
  );
}
