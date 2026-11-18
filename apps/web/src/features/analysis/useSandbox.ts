import { useEffect, useRef, useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import { sandboxPosition } from "../../api/sandbox";
import type { SandboxPosition } from "../../api/sandbox";

type State = {
  root: number | null;
  branch: string[];
  future: string[];
  saved: string[][];
  position: SandboxPosition | null;
  busy: boolean;
  error: string | null;
};
const empty: State = {
  root: null,
  branch: [],
  future: [],
  saved: [],
  position: null,
  busy: false,
  error: null,
};
function useBranchLoader(game: Game) {
  const [state, setState] = useState<State>(empty);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const load = async (
    root: number,
    branch: string[],
    future: string[],
    saved: string[][],
  ) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({
      ...previous,
      root,
      busy: true,
      error: null,
      position: previous.root === root ? previous.position : null,
    }));
    try {
      const position = await sandboxPosition(
        game,
        root,
        branch,
        current.signal,
      );
      if (!current.signal.aborted)
        setState({
          root,
          branch,
          future,
          saved,
          position,
          busy: false,
          error: null,
        });
    } catch (error) {
      if (!current.signal.aborted)
        setState((previous) => ({
          ...previous,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "Free analysis unavailable.",
        }));
    }
  };
  return { state, setState, controller, load };
}

export function useSandbox(game: Game) {
  const { state, setState, controller, load } = useBranchLoader(game);
  const play = (uci: string) => {
    if (
      state.root === null ||
      state.busy ||
      !state.position?.legal_moves.includes(uci) ||
      state.branch.length >= 100
    )
      return;
    const saved = state.future.length
      ? [...state.saved, [...state.branch, ...state.future]].slice(-20)
      : state.saved;
    void load(state.root, [...state.branch, uci], [], saved);
  };
  return {
    ...state,
    enabled: state.root !== null,
    begin: (ply: number) => {
      void load(ply, [], [], []);
    },
    play,
    seek: (index: number) => {
      if (state.root === null || state.busy) return;
      const all = [...state.branch, ...state.future];
      const cursor = Math.max(0, Math.min(all.length, index));
      void load(
        state.root,
        all.slice(0, cursor),
        all.slice(cursor),
        state.saved,
      );
    },
    undo: () => {
      if (state.root !== null && state.branch.length && !state.busy) {
        const last = state.branch[state.branch.length - 1];
        if (last)
          void load(
            state.root,
            state.branch.slice(0, -1),
            [last, ...state.future],
            state.saved,
          );
      }
    },
    redo: () => {
      const move = state.future[0];
      if (state.root !== null && move && !state.busy)
        void load(
          state.root,
          [...state.branch, move],
          state.future.slice(1),
          state.saved,
        );
    },
    choose: (index: number) => {
      const branch = state.saved[index];
      if (state.root !== null && branch && !state.busy)
        void load(state.root, branch, [], state.saved);
    },
    exit: () => {
      controller.current?.abort();
      setState(empty);
    },
  };
}
export type Sandbox = ReturnType<typeof useSandbox>;
