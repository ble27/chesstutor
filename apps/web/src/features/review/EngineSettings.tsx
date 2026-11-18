import { useState } from "react";
import type { Mode } from "../../api/analysis";
export type LocalSettings = { depth: number; threads: number };
export const defaultLocalSettings: LocalSettings = { depth: 18, threads: 1 };
export function EngineSettings({
  busy,
  start,
  local,
  setLocal,
}: {
  busy: boolean;
  start: (mode: Mode) => void;
  local: LocalSettings;
  setLocal: (settings: LocalSettings) => void;
}) {
  const [mode, setMode] = useState<Mode>("quick");
  const maximum =
    typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
      ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1))
      : 1;
  return (
    <details className="engine-settings">
      <summary aria-label="Engine settings" title="Engine settings">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
        </svg>{" "}
        Settings
      </summary>
      <label>
        Server review
        <select
          value={mode}
          onChange={(event) =>
            setMode(event.target.value === "deep" ? "deep" : "quick")
          }
        >
          <option value="quick">Standard</option>
          <option value="deep">Thorough</option>
        </select>
      </label>
      <button disabled={busy} onClick={() => start(mode)}>
        Run review
      </button>
      <label>
        Local search depth
        <input
          type="number"
          min={1}
          max={40}
          step={1}
          value={local.depth}
          onChange={(event) => {
            const depth = Number(event.target.value);
            if (Number.isInteger(depth) && depth >= 1 && depth <= 40)
              setLocal({ ...local, depth });
          }}
        />
      </label>
      <label>
        Local engine threads
        <select
          value={Math.min(local.threads, maximum)}
          onChange={(event) =>
            setLocal({ ...local, threads: Number(event.target.value) })
          }
        >
          {Array.from({ length: maximum }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <p>
        Local searches use this device: Stockfish 17.1, up to 10 seconds, 128
        MiB hash. Requested depth may not be reached. Local scores do not change
        server coaching or game accuracy.
      </p>
    </details>
  );
}
