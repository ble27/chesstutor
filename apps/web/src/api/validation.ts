import type { components } from "./generated";

export type Health = components["schemas"]["HealthResponse"];
export type ServerError = components["schemas"]["ErrorResponse"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseHealth(value: unknown): Health {
  if (!isRecord(value) || (value.status !== "ok" && value.status !== "ready")) {
    throw new Error("Invalid health response");
  }
  return { status: value.status };
}

export function parseServerError(value: unknown): ServerError | null {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.message !== "string" ||
    typeof value.retryable !== "boolean" ||
    typeof value.request_id !== "string"
  ) {
    return null;
  }
  return {
    code: value.code,
    message: value.message,
    retryable: value.retryable,
    request_id: value.request_id,
  };
}
