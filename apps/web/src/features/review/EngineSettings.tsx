import { useRef, useState } from "react";
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
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("quick");
  const maximum =
    typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
      ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1))
      : 1;
  return (
    <>
      <button
        className="settings-trigger"
        aria-label="Engine settings"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        Settings
      </button>
      <dialog
        ref={dialog}
        className="settings-dialog"
        aria-labelledby="settings-title"
      >
        <div className="module-heading">
          <h2 id="settings-title">Engine settings</h2>
          <button onClick={() => dialog.current?.close()}>Done</button>
        </div>
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
        <button
          disabled={busy}
          onClick={() => {
            start(mode);
            dialog.current?.close();
          }}
        >
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
      </dialog>
    </>
  );
}
