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
          Chess Tutor
        </a>
        <span className="tag">Independent game review</span>
      </header>
      <section className="intro" aria-labelledby="page-title">
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
      <footer>
        Free, independent analysis. Not affiliated with Chess.com.
      </footer>
    </main>
  );
}
