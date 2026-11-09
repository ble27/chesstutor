import { useEffect, useState } from "react";
import { playerRatings } from "../../api/ratings";
import type { Ratings } from "../../api/ratings";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: Ratings };

export function usePlayerRatings(username: string) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    playerRatings(username, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState(
            data.username === username
              ? { status: "ready", data }
              : { status: "error" },
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [username, attempt]);
  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((current) => current + 1);
    },
  };
}
