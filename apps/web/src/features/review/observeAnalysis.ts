import { active, readAnalysis } from "../../api/analysis";
import type { Analysis } from "../../api/analysis";
import { ApiError } from "../../api/client";

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new ApiError("aborted", "Request cancelled.", false));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function observeAnalysis(
  initial: Promise<Analysis>,
  signal: AbortSignal,
  validate: (job: Analysis) => void,
  publish: (job: Analysis) => void,
): Promise<void> {
  let job = await initial;
  let delay = 1000;
  while (!signal.aborted) {
    validate(job);
    publish(job);
    if (!active(job)) return;
    await pause(delay, signal);
    const next = await readAnalysis(job.id, signal);
    if (
      next.id !== job.id ||
      next.mode !== job.mode ||
      next.completed_plies < job.completed_plies
    )
      throw new ApiError(
        "invalid_response",
        "The service returned mismatched analysis data.",
        false,
      );
    delay =
      next.completed_plies === job.completed_plies
        ? Math.min(5000, delay + 1000)
        : 1000;
    job = next;
  }
}
