import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api/client";
import * as api from "./api/discovery";
import type { Archives, Game, Games } from "./api/discoveryValidation";

export type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: ApiError };
const idle = { status: "idle" } as const;
function failure(error: unknown): Load<never> {
  return {
    status: "error",
    error:
      error instanceof ApiError
        ? error
        : new ApiError(
            "unexpected",
            "The lookup could not be completed.",
            true,
          ),
  };
}

function useLoad<T>() {
  const [state, setState] = useState<Load<T>>(idle);
  const run = async (request: () => Promise<T>, signal: AbortSignal) => {
    setState({ status: "loading" });
    try {
      const data = await request();
      if (signal.aborted) return;
      setState({ status: "ready", data });
      return data;
    } catch (error) {
      if (!signal.aborted) setState(failure(error));
    }
  };
  return { state, run, reset: () => setState(idle) };
}

export function useDiscovery() {
  const archive = useLoad<Archives>();
  const list = useLoad<Games>();
  const game = useLoad<Game>();
  const [month, setMonth] = useState("");
  const [filters, setFilters] = useState(api.emptyFilters);
  const controller = useRef<AbortController | null>(null);
  const start = useCallback(() => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    return current.signal;
  }, []);
  useEffect(() => () => controller.current?.abort(), []);

  const search = async (username: string) => {
    const signal = start();
    list.reset();
    game.reset();
    setMonth("");
    setFilters(api.emptyFilters);
    const data = await archive.run(
      () => api.archives(username, signal),
      signal,
    );
    if (!data || signal.aborted) return;
    const newest = data.months[0];
    if (newest) {
      setMonth(newest);
      await list.run(
        () => api.games(data.username, newest, api.emptyFilters, null, signal),
        signal,
      );
    }
  };
  const select = async (
    selected: string,
    nextFilters: api.Filters,
    cursor: string | null = null,
  ) => {
    if (archive.state.status !== "ready") return;
    const username = archive.state.data.username;
    const signal = start();
    setMonth(selected);
    setFilters(nextFilters);
    game.reset();
    await list.run(
      () => api.games(username, selected, nextFilters, cursor, signal),
      signal,
    );
  };
  const open = async (id: string) => {
    const signal = start();
    await game.run(() => api.openGame(id, signal), signal);
  };
  return {
    archive: archive.state,
    list: list.state,
    game: game.state,
    month,
    filters,
    search,
    select,
    open,
  };
}
