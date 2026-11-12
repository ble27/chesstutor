import { useCallback, useEffect, useRef, useState } from "react";
import { askCoach, readLessons } from "../../api/coaching";
import type {
  CoachAnswer,
  CoachRequest,
  Level,
  Lessons,
} from "../../api/coaching";
import { ApiError } from "../../api/client";
import type { Analysis } from "../../api/analysis";

export type LessonState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lessons: Lessons }
  | { status: "error"; error: ApiError };

export type AnswerState =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "answered"; answer: CoachAnswer }
  | { status: "error"; error: ApiError; request: CoachRequest };

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError("unexpected", "Chess guidance could not be loaded.", true);
}

type Settled = Extract<LessonState, { status: "ready" | "error" }>;

export function useLessons(
  analysis: Analysis | null,
  level: Level,
): LessonState {
  const [settled, setSettled] = useState<{
    scope: string;
    value: Settled;
  } | null>(null);
  const id = analysis?.id;
  const scope = id ? `${id}:${level}` : null;
  const progress = `${analysis?.state}:${analysis?.completed_plies}`;
  useEffect(() => {
    if (!id || !scope) return;
    const controller = new AbortController();
    const settle = (value: Settled) => {
      if (!controller.signal.aborted) setSettled({ scope, value });
    };
    readLessons(id, level, controller.signal)
      .then((lessons) => settle({ status: "ready", lessons }))
      .catch((error: unknown) =>
        settle({ status: "error", error: asApiError(error) }),
      );
    return () => controller.abort();
  }, [id, level, scope, progress]);
  // Notes for the same game and level stay visible while a poll refreshes them.
  if (!scope) return { status: "idle" };
  return settled?.scope === scope ? settled.value : { status: "loading" };
}

export function useCoach(analysis: Analysis | null) {
  const [settled, setSettled] = useState<{
    id: string;
    state: AnswerState;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const id = analysis?.id;
  useEffect(() => () => controller.current?.abort(), [id]);
  const ask = useCallback(
    (request: CoachRequest) => {
      if (!id) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setSettled({ id, state: { status: "asking" } });
      askCoach(id, request, current.signal)
        .then((answer) => {
          if (!current.signal.aborted)
            setSettled({ id, state: { status: "answered", answer } });
        })
        .catch((error: unknown) => {
          if (!current.signal.aborted)
            setSettled({
              id,
              state: { status: "error", error: asApiError(error), request },
            });
        });
    },
    [id],
  );
  const reset = useCallback(() => {
    controller.current?.abort();
    setSettled(null);
  }, []);
  const state: AnswerState =
    settled?.id === id && settled ? settled.state : { status: "idle" };
  return { state, ask, reset };
}
