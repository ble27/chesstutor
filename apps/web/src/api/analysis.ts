import type { components } from "./generated";
import { ApiError, request } from "./client";
import { evidence } from "./analysisEvidence";
import { review, summary, validateReview } from "./classification";
import {
  array,
  date,
  flag,
  identifier,
  integer,
  object,
  text,
} from "./analysisFields";

export type Analysis = components["schemas"]["AnalysisResponse"];
export type Mode = "quick" | "deep";
export const active = (job: Analysis) =>
  job.state === "queued" ||
  job.state === "running" ||
  job.state === "cancel_requested";

function lifecycle(value: unknown): Analysis["state"] {
  switch (value) {
    case "queued":
    case "running":
    case "cancel_requested":
    case "cancelled":
    case "completed":
    case "failed":
      return value;
    default:
      throw new Error("Invalid lifecycle");
  }
}
export function parseAnalysis(input: unknown): Analysis {
  const value = object(input),
    mode = value.mode;
  if (mode !== "quick" && mode !== "deep") throw new Error("Invalid mode");
  const state = lifecycle(value.state),
    total = integer(value.total_plies, 1, 300);
  const completed = integer(value.completed_plies, 0, total);
  const lines = array(value.evidence, 300).map(evidence);
  if (state === "completed" && completed !== total)
    throw new Error("Incomplete completed job");
  if (
    lines.length !== completed ||
    lines.some((item, index) => item.ply !== index + 1)
  )
    throw new Error("Invalid coverage");
  const classifications =
    value.classifications === undefined
      ? []
      : array(value.classifications, 300).map(review);
  const classificationSummary =
    value.summary === undefined || value.summary === null
      ? null
      : summary(value.summary);
  validateReview(
    classifications,
    classificationSummary,
    lines,
    mode,
    state,
    total,
  );
  const engine = object(value.engine),
    options = object(engine.options);
  if (
    options.Threads !== 1 ||
    options.Hash !== 128 ||
    options.UCI_ShowWDL !== true
  )
    throw new Error("Invalid engine options");
  const checksum = text(engine.binary_sha256, 64);
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Invalid provenance");
  return {
    id: identifier(value.id),
    game_id: identifier(value.game_id),
    game_version: integer(value.game_version, 1),
    mode,
    state,
    completed_plies: completed,
    total_plies: total,
    attempts: integer(value.attempts, 0, 2),
    created_at: date(value.created_at),
    updated_at: date(value.updated_at),
    deadline_at: value.deadline_at === null ? null : date(value.deadline_at),
    error_code: value.error_code === null ? null : text(value.error_code, 40),
    dispatch_pending: flag(value.dispatch_pending),
    cached: flag(value.cached),
    can_cancel: flag(value.can_cancel),
    evidence: lines,
    classifications,
    summary: classificationSummary,
    engine: {
      version: text(engine.version, 30),
      binary_sha256: checksum,
      nnue: text(engine.nnue),
      options: { Threads: 1, Hash: 128, UCI_ShowWDL: true },
    },
  };
}
export async function createAnalysis(
  game_id: string,
  mode: Mode,
  signal: AbortSignal,
): Promise<Analysis> {
  const submit = () =>
    request("/api/v1/analyses", parseAnalysis, {
      method: "POST",
      body: JSON.stringify({ game_id, mode }),
      signal,
      timeoutMs: 10000,
    });
  let job: Analysis;
  try {
    job = await submit();
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 409 ||
      error.code !== "session_required"
    )
      throw error;
    // The challenge sets the HttpOnly cookie without allocating work. Retry
    // once, after receipt; blocked cookies never trigger a retry loop.
    job = await submit();
  }
  if (
    job.mode !== mode &&
    !(mode === "quick" && job.mode === "deep" && job.cached)
  )
    throw new ApiError(
      "invalid_response",
      "The service returned the wrong analysis preset.",
      false,
    );
  return job;
}
export const readAnalysis = (id: string, signal: AbortSignal) =>
  request(`/api/v1/analyses/${encodeURIComponent(id)}`, parseAnalysis, {
    signal,
    timeoutMs: 10000,
  });
export const cancelAnalysis = (id: string, signal: AbortSignal) =>
  request(`/api/v1/analyses/${encodeURIComponent(id)}/cancel`, parseAnalysis, {
    method: "POST",
    signal,
    timeoutMs: 10000,
  });
