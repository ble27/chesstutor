import { Discovery } from "./Discovery";
import { useServiceStatus } from "./useServiceStatus";

export function App() {
  const status = useServiceStatus();
  return (
    <main className="app">
      <header className="masthead">
        <a className="brand" href="/" aria-label="Chess Tutor home">
          <span className="brand-mark" aria-hidden="true">
            <img src="/pieces/classic/wN.svg" alt="" />
          </span>
          Chess Tutor
        </a>
        {status !== "ready" && (
          <span className="service-status" role="status">
            {status === "connecting"
              ? "Connecting…"
              : "Review service unavailable"}
          </span>
        )}
      </header>
      <Discovery />
    </main>
  );
}
