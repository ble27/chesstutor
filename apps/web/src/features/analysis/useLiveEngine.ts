import { useEffect, useRef, useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";
import { sandboxPosition } from "../../api/sandbox";
import type { SandboxPosition } from "../../api/sandbox";
import { openBrowserEngine } from "../browserExperiment/engine";
import type { BrowserEngine } from "../browserExperiment/engine";
import type { LocalSettings } from "../review/EngineSettings";

type Live = { key: string; lines: Evidence["played"][]; message: string };
type EngineSession = {
  controller: AbortController;
  engine?: BrowserEngine;
  tail: Promise<void>;
};

function enqueue(session: EngineSession, search: () => Promise<void>) {
  // UCI search output has no request ID. Wait for the old bestmove before sending a new position.
  session.tail = session.tail.then(search);
}

export function useLiveEngine(
  game: Game,
  rootPly: number,
  branch: readonly string[],
  position: SandboxPosition | null,
  settings: LocalSettings,
  enabled: boolean,
) {
  const [state, setState] = useState<Live | null>(null);
  const sessionRef = useRef<EngineSession | null>(null);
  const moves = branch.join(" ");
  const { depth, threads } = settings;
  const key = JSON.stringify([
    game.pgn_hash,
    rootPly,
    moves,
    position?.fen,
    depth,
    threads,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    sessionRef.current = { controller, tail: Promise.resolve() };
    return () => {
      sessionRef.current = null;
      controller.abort();
    };
  }, [game, enabled, threads]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!enabled || !session || !position || position.result) return;
    const current = new AbortController();
    const publish = (message: string, lines: Evidence["played"][] = []) => {
      if (!current.signal.aborted) setState({ key, lines, message });
    };
    const timer = setTimeout(() => {
      enqueue(session, async () => {
        if (current.signal.aborted) return;
        try {
          if (!session.engine || session.engine.isClosed)
            session.engine = await openBrowserEngine(
              threads,
              session.controller.signal,
              publish,
            );
          if (current.signal.aborted) return;
          await searchPosition(session.engine);
        } catch (error: unknown) {
          publish(
            error instanceof Error
              ? error.message
              : "Local analysis unavailable.",
          );
        }
      });
    }, 150);

    async function searchPosition(engine: BrowserEngine) {
      if (!position || !session) return;
      let lastValidation = 0;
      let sequence = 0;
      const validate = async (raw: Parameters<typeof sandboxPosition>[4]) => {
        const request = ++sequence;
        const result = await sandboxPosition(
          game,
          rootPly,
          moves ? moves.split(" ") : [],
          current.signal,
          raw,
        );
        if (request === sequence) publish("", result.lines ?? []);
      };
      const raw = await engine.searchPosition(
        position.initial_fen,
        position.moves,
        depth,
        session.controller.signal,
        (raw) => {
          if (performance.now() - lastValidation >= 500) {
            lastValidation = performance.now();
            void validate(raw).catch(() => undefined);
          }
        },
        current.signal,
      );
      if (!current.signal.aborted) await validate(raw);
    }

    return () => {
      clearTimeout(timer);
      current.abort();
    };
  }, [game, rootPly, moves, position, depth, threads, enabled, key]);

  return enabled && state?.key === key
    ? state
    : {
        key,
        lines: [],
        message: position?.result ? "Terminal position" : "Analyzing…",
      };
}
