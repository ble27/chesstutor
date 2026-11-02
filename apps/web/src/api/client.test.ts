import { afterEach, expect, it, vi } from "vitest";
import { request } from "./client";
import { parseHealth, parseServerError } from "./validation";

afterEach(() => vi.useRealTimers());

it("decodes a successful typed response", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "ready" }));
  vi.stubGlobal("fetch", fetcher);
  await expect(request("/api/v1/health/ready", parseHealth)).resolves.toEqual({
    status: "ready",
  });
  expect(fetcher).toHaveBeenCalledWith(
    "/api/v1/health/ready",
    expect.objectContaining({ credentials: "same-origin" }),
  );
});

it.each([null, [], { status: "maybe" }, { status: 1 }])(
  "rejects invalid health data %j",
  async (value) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(value)));
    await expect(
      request("/api/v1/health/live", parseHealth),
    ).rejects.toMatchObject({ code: "invalid_response" });
  },
);

it("maps the backend error envelope", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          code: "dependencies_unavailable",
          message: "Services are starting",
          retryable: true,
          request_id: "request-1",
        },
        { status: 503 },
      ),
    ),
  );
  await expect(
    request("/api/v1/health/ready", parseHealth),
  ).rejects.toMatchObject({
    code: "dependencies_unavailable",
    retryable: true,
    status: 503,
    requestId: "request-1",
  });
});

it("falls back safely for malformed server errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "untrusted" }, { status: 502 }),
      ),
  );
  await expect(
    request("/api/v1/health/live", parseHealth),
  ).rejects.toMatchObject({ code: "http_error", retryable: true });
  expect(parseServerError({ code: 1 })).toBeNull();
});

it("rejects unreadable JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>proxy failure</html>")),
  );
  await expect(
    request("/api/v1/health/live", parseHealth),
  ).rejects.toMatchObject({ code: "invalid_response" });
});

it("reports network failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  await expect(
    request("/api/v1/health/live", parseHealth),
  ).rejects.toMatchObject({ code: "network", retryable: true });
});

it("does not send an already cancelled request", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const controller = new AbortController();
  controller.abort();
  await expect(
    request("/api/v1/health/live", parseHealth, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "aborted", retryable: false });
  expect(fetcher).not.toHaveBeenCalled();
});

it("bounds slow requests and cleans up timers", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  const result = expect(
    request("/api/v1/health/live", parseHealth, { timeoutMs: 50 }),
  ).rejects.toMatchObject({ code: "timeout", retryable: true });
  await vi.advanceTimersByTimeAsync(50);
  await result;
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects invalid request budgets", async () => {
  await expect(
    request("/api/v1/health/live", parseHealth, { timeoutMs: 0 }),
  ).rejects.toBeInstanceOf(RangeError);
});

it("cancels an in-flight request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  const controller = new AbortController();
  const result = expect(
    request("/api/v1/health/live", parseHealth, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "aborted", retryable: false });
  controller.abort();
  await result;
});
