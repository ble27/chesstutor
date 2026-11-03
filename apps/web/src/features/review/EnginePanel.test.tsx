import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { imported } from "../../testFixtures/discovery";
import { completedAnalysis, queuedAnalysis } from "../../testFixtures/analysis";
import { EnginePanel } from "./EnginePanel";

afterEach(() => vi.useRealTimers());

const validEvidence = completedAnalysis.evidence[0];
if (!validEvidence) throw new Error("Missing analysis fixture");
const validLine = validEvidence.played;

it.each([
  { ...completedAnalysis, completed_plies: 0 },
  { ...completedAnalysis, state: "ready-ish" },
  { ...queuedAnalysis, total_plies: 0 },
  { ...queuedAnalysis, attempts: 3 },
  {
    ...queuedAnalysis,
    engine: { ...queuedAnalysis.engine, binary_sha256: "bad" },
  },
  {
    ...queuedAnalysis,
    engine: {
      ...queuedAnalysis.engine,
      options: { Threads: 99, Hash: 128, UCI_ShowWDL: true },
    },
  },
  { ...completedAnalysis, evidence: [{ ...validEvidence, before_ply: 1 }] },
  {
    ...completedAnalysis,
    evidence: [{ ...validEvidence, root_fen: "not FEN" }],
  },
  {
    ...completedAnalysis,
    evidence: [{ ...validEvidence, played_uci: "d2d4" }],
  },
  {
    ...completedAnalysis,
    evidence: [{ ...validEvidence, expected_loss: -0.1 }],
  },
  {
    ...completedAnalysis,
    evidence: [{ ...validEvidence, played: { ...validLine, pv: [] } }],
  },
  {
    ...completedAnalysis,
    evidence: [
      {
        ...validEvidence,
        played: { ...validLine, score: { kind: "unknown" } },
      },
    ],
  },
  {
    ...completedAnalysis,
    evidence: [
      {
        ...validEvidence,
        played: {
          ...validLine,
          score: { kind: "cp", centipawns: 100, pov: "black" },
        },
      },
    ],
  },
  {
    ...completedAnalysis,
    evidence: [
      {
        ...validEvidence,
        played: {
          ...validLine,
          wdl: { wins: 600, draws: 600, losses: 100, pov: "white" },
        },
      },
    ],
  },
])(
  "rejects malformed analysis data before rendering evidence %#",
  async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    render(<EnginePanel game={imported} selectedPly={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.queryByRole("list", { name: "Engine variations" }),
    ).not.toBeInTheDocument();
  },
);

it("keeps mate units separate from centipawns in White-perspective display", async () => {
  const line = {
    ...validLine,
    score: { kind: "mate", moves: -3, pov: "white" },
  };
  const payload = {
    ...completedAnalysis,
    evidence: [{ ...validEvidence, best: [line] }],
  };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(await screen.findByText("White evaluation: -M3")).toBeVisible();
});

it("submits Quick and displays queued progress without claiming completion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(queuedAnalysis)),
  );
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(
    await screen.findByRole("status", { name: "Analysis progress" }),
  ).toHaveTextContent("Quick · Queued · 0/1 plies");
  expect(screen.getByRole("button", { name: "Cancel analysis" })).toBeEnabled();
  expect(screen.queryByText("Analysis completed")).not.toBeInTheDocument();
});

it("polls progress until completion and stops polling terminal jobs", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json(queuedAnalysis))
    .mockResolvedValueOnce(
      Response.json({ ...queuedAnalysis, state: "running", attempts: 1 }),
    )
    .mockResolvedValueOnce(Response.json(completedAnalysis));
  vi.stubGlobal("fetch", fetcher);
  render(<EnginePanel game={imported} selectedPly={1} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Quick review" })),
  );
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(
    screen.getByRole("status", { name: "Analysis progress" }),
  ).toHaveTextContent("Running");
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(
    screen.getByRole("status", { name: "Analysis progress" }),
  ).toHaveTextContent("Completed · 1/1 plies");
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("cancels an owned job, preserves partial status, and permits explicit retry", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(queuedAnalysis))
      .mockResolvedValueOnce(
        Response.json({ ...queuedAnalysis, state: "cancel_requested" }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...queuedAnalysis,
          state: "cancelled",
          can_cancel: false,
          dispatch_pending: false,
        }),
      )
      .mockResolvedValueOnce(Response.json(queuedAnalysis)),
  );
  render(<EnginePanel game={imported} selectedPly={1} />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Quick review" })),
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" })),
  );
  expect(
    screen.getByRole("button", { name: "Cancel analysis" }),
  ).toBeDisabled();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText(/Partial evidence retained/)).toBeVisible();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Retry analysis" })),
  );
  expect(
    screen.getByRole("status", { name: "Analysis progress" }),
  ).toHaveTextContent("Queued");
});

it("rejects Quick results returned for a Deep request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(completedAnalysis)),
  );
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Deep review" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/preset/);
  expect(screen.queryByText("White evaluation: +1.2")).not.toBeInTheDocument();
});

it("aborts old-game requests and ignores late responses after switching games", async () => {
  let resolve: (response: Response) => void = () => {
    throw new Error("No request");
  };
  const fetcher = vi.fn<
    (url: string, options: RequestInit) => Promise<Response>
  >(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  rerender(<EnginePanel game={{ ...imported, version: 2 }} selectedPly={1} />);
  expect(fetcher.mock.calls[0]?.[1].signal?.aborted).toBe(true);
  await act(async () => resolve(Response.json(completedAnalysis)));
  expect(
    screen.queryByRole("status", { name: "Analysis progress" }),
  ).not.toBeInTheDocument();
});

it("shows legal alternatives with explicit pre-move root and White evaluation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json(completedAnalysis)),
  );
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(await screen.findByText("White evaluation: +1.2")).toBeVisible();
  expect(
    screen.getByText("Before selected move · Position ply 0"),
  ).toBeVisible();
  expect(screen.getByText(/Best move: e4/)).toBeVisible();
  expect(
    screen.getByRole("list", { name: "Engine variations" }),
  ).toHaveTextContent("e4");
});

it("establishes the HttpOnly session before submitting engine work", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        {
          code: "session_required",
          message: "Accept the session cookie before submitting analysis.",
          retryable: true,
          request_id: "fixture",
        },
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(Response.json(completedAnalysis));
  vi.stubGlobal("fetch", fetcher);
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(await screen.findByText("White evaluation: +1.2")).toBeVisible();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]?.[1].body).toBe(fetcher.mock.calls[1]?.[1].body);
});

it("stops the session challenge after one retry when cookies are blocked", async () => {
  const fetcher = vi.fn().mockImplementation(() =>
    Promise.resolve(
      Response.json(
        {
          code: "session_required",
          message: "Accept the session cookie before submitting analysis.",
          retryable: true,
          request_id: "fixture",
        },
        { status: 409 },
      ),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<EnginePanel game={imported} selectedPly={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick review" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Accept the session cookie",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
