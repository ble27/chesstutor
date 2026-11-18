import { useEffect, useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import type { Evidence } from "../../api/analysisEvidence";
import { sandboxPosition } from "../../api/sandbox";
import type { SandboxPosition } from "../../api/sandbox";
import { openBrowserEngine } from "../browserExperiment/engine";
import type { LocalSettings } from "../review/EngineSettings";

type Live = { key: string; line: Evidence["played"] | null; message: string };
export function useLiveEngine(
  game: Game,
  rootPly: number,
  branch: readonly string[],
  position: SandboxPosition | null,
  settings: LocalSettings,
  enabled: boolean,
) {
  const [state, setState] = useState<Live | null>(null);
  const moves = branch.join(" ");
  const key = `${rootPly}:${moves}:${position?.fen}:${settings.depth}:${settings.threads}`;
  useEffect(() => {
    if (!enabled || !position || position.result) return;
    const current = new AbortController();
    const publish = (
      message: string,
      line: Evidence["played"] | null = null,
    ) => {
      if (!current.signal.aborted) setState({ key, line, message });
    };
    const timer = setTimeout(() => {
      void (async () => {
        const engine = await openBrowserEngine(
          settings.threads,
          current.signal,
          publish,
        );
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
          if (!current.signal.aborted && request === sequence)
            publish(
              `Local depth ${result.line?.depth ?? 0} / requested ${settings.depth}`,
              result.line,
            );
        };
        try {
          const raw = await engine.searchPosition(
            position.initial_fen,
            position.moves,
            settings.depth,
            current.signal,
            (raw) => {
              if (performance.now() - lastValidation >= 500) {
                lastValidation = performance.now();
                void validate(raw).catch(() => undefined);
              }
            },
          );
          await validate(raw);
        } finally {
          engine.close();
        }
      })().catch((error: unknown) =>
        publish(
          error instanceof Error
            ? error.message
            : "Local analysis unavailable.",
        ),
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      current.abort();
    };
  }, [
    game,
    rootPly,
    moves,
    position,
    settings.depth,
    settings.threads,
    enabled,
    key,
  ]);
  return enabled && state?.key === key
    ? state
    : {
        key,
        line: null,
        message: position?.result
          ? "Terminal position"
          : "Local engine waiting…",
      };
}
