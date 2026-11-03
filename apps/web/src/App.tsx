import { Discovery } from "./Discovery";
import { useServiceStatus } from "./useServiceStatus";

const statusText = {
  connecting: "Connecting to review service…",
  ready: "Review service connected",
  unavailable: "Review service unavailable. Please try again later.",
};

export function App() {
  const status = useServiceStatus();
  return (
    <main className="app">
      <header className="masthead">
        <a className="brand" href="/" aria-label="Chess Tutor home">
          <span aria-hidden="true">♘</span> Chess Tutor
        </a>
        <span className="tag">Independent game review</span>
      </header>
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">A little reflection. A better next game.</p>
        <h1 id="page-title">Understand every move.</h1>
        <p>
          Review public games, explore the alternatives, and learn at your own
          pace.
        </p>
        <p className="service-status" role="status">
          {statusText[status]}
        </p>
      </section>
      <Discovery />
      <div className="workspace">
        <section className="panel game-space" aria-labelledby="game-title">
          <span className="workspace-mark" aria-hidden="true">
            ♘
          </span>
          <h2 id="game-title">Your game, in focus</h2>
          <p>A space to replay both sides and discover the turning points.</p>
        </section>
        <aside className="insights" aria-label="Game insights">
          <section className="panel" aria-labelledby="engine-title">
            <p className="eyebrow">The position</p>
            <h2 id="engine-title">Engine analysis</h2>
            <p>
              Best moves and alternative lines, with a choice of quick or deeper
              review.
            </p>
          </section>
          <section className="panel" aria-labelledby="coach-title">
            <p className="eyebrow">The lesson</p>
            <h2 id="coach-title">Chess guidance</h2>
            <p>
              Clear explanations and practical ideas to carry into your next
              game.
            </p>
          </section>
        </aside>
      </div>
      <footer>
        Free, independent analysis. Not affiliated with Chess.com.
      </footer>
    </main>
  );
}
