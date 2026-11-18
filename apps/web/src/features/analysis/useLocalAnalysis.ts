import { useEffect, useState } from "react";
import type { Game } from "../../api/discoveryValidation";
import { sandboxPosition } from "../../api/sandbox";
import type { SandboxPosition } from "../../api/sandbox";
import { defaultLocalSettings } from "../review/EngineSettings";
import { useSandbox } from "./useSandbox";
import { useLiveEngine } from "./useLiveEngine";
export function useLocalAnalysis(game: Game, selectedPly: number) {
  const sandbox = useSandbox(game);
  const [settings, setSettings] = useState(defaultLocalSettings);
  const [refineRoot, setRefineRoot] = useState<number | null>(null);
  const refine = refineRoot !== null;
  const root = refineRoot ?? selectedPly;
  const setRefine = (enabled: boolean) =>
    setRefineRoot(enabled ? selectedPly : null);
  const [suggestions, setSuggestions] = useState(true);
  const [promotion, setPromotion] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<{
    ply: number;
    position: SandboxPosition;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!refine || sandbox.enabled) return;
    const current = new AbortController();
    sandboxPosition(game, root, [], current.signal)
      .then((position) => {
        if (!current.signal.aborted) setRecorded({ ply: root, position });
      })
      .catch((error: unknown) => {
        if (!current.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Position unavailable.",
          );
      });
    return () => current.abort();
  }, [game, root, refine, sandbox.enabled]);
  const position = sandbox.enabled
    ? sandbox.position
    : recorded?.ply === root
      ? recorded.position
      : null;
  const live = useLiveEngine(
    game,
    sandbox.root ?? root,
    sandbox.enabled ? sandbox.branch : [],
    sandbox.busy ? null : position,
    settings,
    refine || sandbox.enabled,
  );
  const play = (move: string) => {
    const choices =
      sandbox.position?.legal_moves.filter((uci) => uci.startsWith(move)) ?? [];
    if (choices.length > 1 && move.length === 4) setPromotion(move);
    else {
      sandbox.play(move);
      setPromotion(null);
    }
  };
  return {
    sandbox,
    settings,
    setSettings,
    refine,
    refineRoot,
    startRefine: (ply: number) => setRefineRoot(ply),
    setRefine,
    suggestions,
    setSuggestions,
    promotion,
    setPromotion,
    play,
    live,
    error,
    position,
  };
}
export type LocalAnalysis = ReturnType<typeof useLocalAnalysis>;
