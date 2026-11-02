import type { paths } from "./generated";
import { parseServerError } from "./validation";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly status: number = 0,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

async function readJson(response: Response): Promise<unknown> {
  try {
    const value: unknown = await response.json();
    return value;
  } catch {
    throw new ApiError(
      "invalid_response",
      "The service returned an unreadable response.",
      true,
    );
  }
}

function responseError(response: Response, value: unknown): ApiError {
  const error = parseServerError(value);
  return new ApiError(
    error?.code ?? "http_error",
    error?.message ?? "The request could not be completed.",
    error?.retryable ?? (response.status === 429 || response.status >= 500),
    response.status,
    error?.request_id ?? null,
  );
}

export async function request<T>(
  path: keyof paths,
  decode: (value: unknown) => T,
  options: RequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new RangeError("Request timeout must be between 1 and 30000ms");
  }
  const timeout = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout.signal])
    : timeout.signal;
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  try {
    signal.throwIfAborted();
    const response = await fetch(path, { signal, credentials: "same-origin" });
    const value = await readJson(response);
    if (!response.ok) throw responseError(response, value);
    try {
      return decode(value);
    } catch {
      throw new ApiError(
        "invalid_response",
        "The service returned unexpected data.",
        true,
      );
    }
  } catch (error: unknown) {
    if (options.signal?.aborted) {
      throw new ApiError("aborted", "Request cancelled.", false);
    }
    if (timeout.signal.aborted) {
      throw new ApiError(
        "timeout",
        "The service took too long to respond.",
        true,
      );
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("network", "The service could not be reached.", true);
  } finally {
    clearTimeout(timer);
  }
}
