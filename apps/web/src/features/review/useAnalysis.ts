import { useEffect, useEffectEvent, useRef, useState } from "react";
import { cancelAnalysis, createAnalysis } from "../../api/analysis";
import type { Analysis, Mode } from "../../api/analysis";
import { ApiError } from "../../api/client";
import type { Game } from "../../api/discoveryValidation";
import { observeAnalysis } from "./observeAnalysis";

type State =
  | { status: "idle"; job: null }
  | { status: "loading"; job: Analysis | null }
  | { status: "ready"; job: Analysis }
  | { status: "error"; job: Analysis | null; error: ApiError };

function matchingGame(job: Analysis, game: Game) {
  if (
    job.game_id !== game.game.id ||
    job.game_version !== game.version ||
    job.total_plies !== game.positions.length - 1
  )
    throw new ApiError(
      "game_changed",
      "This game changed. Reopen it before reviewing.",
      false,
    );
  for (const evidence of job.evidence) {
    if (
      game.positions[evidence.before_ply]?.fen !== evidence.root_fen ||
      game.positions[evidence.ply]?.uci !== evidence.played_uci
    )
      throw new ApiError(
        "invalid_response",
        "Analysis evidence does not match this game.",
        false,
      );
  }
}

export function useAnalysis(game: Game, automatic = false) {
  const [state, setState] = useState<State>({ status: "idle", job: null });
  const [mode, setMode] = useState<Mode>("quick");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const run = async (operation: (signal: AbortSignal) => Promise<Analysis>) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ status: "loading", job: previous.job }));
    try {
      await observeAnalysis(
        operation(current.signal),
        current.signal,
        (job) => matchingGame(job, game),
        (job) => {
          if (!current.signal.aborted) setState({ status: "ready", job });
        },
      );
    } catch (error) {
      if (!current.signal.aborted)
        setState((previous) => ({
          status: "error",
          job: previous.job,
          error:
            error instanceof ApiError
              ? error
              : new ApiError(
                  "unexpected",
                  "Analysis could not be loaded.",
                  true,
                ),
        }));
    }
  };
  const start = (selected: Mode) => {
    setMode(selected);
    void run((signal) => createAnalysis(game.game.id, selected, signal));
  };
  const cancel = () => {
    const job = state.job;
    if (job?.can_cancel) void run((signal) => cancelAnalysis(job.id, signal));
  };
  const begin = useEffectEvent(() => start("quick"));
  useEffect(() => {
    let cancelled = false;
    if (automatic)
      queueMicrotask(() => {
        if (!cancelled) begin();
      });
    return () => {
      cancelled = true;
    };
  }, [automatic]);
  return { state, start, cancel, retry: () => start(mode) };
}
