import { usePlayerRatings } from "./usePlayerRatings";
import { TimeControl } from "./TimeControl";

export function PlayerRatings({ username }: { username: string }) {
  const { state, retry } = usePlayerRatings(username);
  return (
    <section
      className="archive-ratings"
      aria-label={`${username}'s current ratings`}
    >
      <div className="ratings-heading">
        <h3>{username}</h3>
        {state.status === "loading" && <p role="status">Loading ratings…</p>}
        {state.status === "error" && (
          <>
            <p>Ratings unavailable</p>
            <button onClick={retry}>Retry ratings</button>
          </>
        )}
        {state.status === "ready" && state.data.stale && (
          <p role="status">Cached ratings</p>
        )}
      </div>
      <dl className="rating-list">
        {(["rapid", "blitz", "bullet"] as const).map((timeClass) => (
          <div key={timeClass}>
            <dt>
              <TimeControl value={timeClass} />
            </dt>
            <dd>
              <strong>
                {state.status === "ready"
                  ? (state.data[timeClass] ?? "Unrated")
                  : "—"}
              </strong>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
