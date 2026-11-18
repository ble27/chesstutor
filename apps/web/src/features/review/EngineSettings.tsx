import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { Mode } from "../../api/analysis";
import { SelectField } from "../../components/ui/Select";

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
  const maximum = globalThis.crossOriginIsolated
    ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1))
    : 1;
  return (
    <Dialog.Root>
      <Dialog.Trigger className="settings-trigger" aria-label="Engine settings">
        Settings
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="settings-overlay" />
        <Dialog.Content
          className="settings-dialog"
          aria-describedby={undefined}
        >
          <div className="module-heading">
            <Dialog.Title>Engine settings</Dialog.Title>
            <Dialog.Close>Done</Dialog.Close>
          </div>
          <SelectField
            label="Server review"
            value={mode}
            onChange={(mode) => setMode(mode === "deep" ? "deep" : "quick")}
            options={[
              { value: "quick", label: "Standard" },
              { value: "deep", label: "Thorough" },
            ]}
          />
          <Dialog.Close disabled={busy} onClick={() => start(mode)}>
            Run review
          </Dialog.Close>
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
          <SelectField
            label="Local engine threads"
            value={String(Math.min(local.threads, maximum))}
            onChange={(threads) =>
              setLocal({ ...local, threads: Number(threads) })
            }
            options={Array.from({ length: maximum }, (_, i) => ({
              value: String(i + 1),
              label: String(i + 1),
            }))}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
