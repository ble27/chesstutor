import { useEffect, useRef, useState } from "react";
import type { Evidence } from "../../api/analysisEvidence";
import type { Game } from "../../api/discoveryValidation";
import { runBrowserReview } from "./run";

export function useBrowserReview(game: Game, threads: number) {
  const [values, setValues] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Ready. Engine assets download on first use.",
  );
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async (selected: number, refine: boolean) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError(null);
    setMessage("Preparing browser review…");
    try {
      await runBrowserReview(
        game,
        selected || 1,
        threads,
        refine,
        current.signal,
        {
          message: (value) => {
            if (!current.signal.aborted) setMessage(value);
          },
          evidence: (incoming) => {
            if (!current.signal.aborted)
              setValues((previous) => {
                const merged = new Map(
                  previous.map((value) => [value.ply, value]),
                );
                for (const value of incoming) merged.set(value.ply, value);
                return [...merged.values()].sort((a, b) => a.ply - b.ply);
              });
          },
        },
      );
    } catch (failure) {
      if (!current.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Browser analysis failed.",
        );
    } finally {
      if (controller.current === current) setBusy(false);
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setBusy(false);
    setMessage(
      "Cancelled. Completed local positions retained; review again to resume.",
    );
  };
  return { values, busy, message, error, run, cancel };
}
