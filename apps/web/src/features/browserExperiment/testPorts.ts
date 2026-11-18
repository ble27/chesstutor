import { vi } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { imported } from "../../testFixtures/discovery";
import { completedAnalysis } from "../../testFixtures/analysis";
import { array, integer, object } from "../../api/analysisFields";

export const twoPlyGame = {
  ...imported,
  positions: [
    ...imported.positions,
    {
      ply: 2,
      san: "e5",
      uci: "e7e5",
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    },
  ],
};

export class FakeWorker {
  static active = new Set<FakeWorker>();
  static commands: string[] = [];
  static roots: string[] = [];
  static held = false;
  static alternative = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: (() => void) | null = null;
  private ply = 1;
  private terminated = false;
  constructor() {
    FakeWorker.active.add(this);
  }
  terminate() {
    this.terminated = true;
    FakeWorker.active.delete(this);
  }
  postMessage(command: string) {
    FakeWorker.commands.push(command);
    if (command.startsWith("position ")) {
      FakeWorker.roots.push(command);
      this.ply = (command.split(" moves ")[1]?.split(" ").length ?? 0) + 1;
    }
    queueMicrotask(() => {
      if (this.terminated) return;
      const send = (data: string) =>
        this.onmessage?.(new MessageEvent("message", { data }));
      if (command === "uci") send("uciok");
      if (command === "isready") send("readyok");
      if (command.startsWith("go ") && !FakeWorker.held) {
        const move = command.includes("searchmoves e2e4")
          ? "e2e4"
          : FakeWorker.alternative && this.ply === 1
            ? "d2d4"
            : this.ply === 1
              ? "e2e4"
              : "e7e5";
        send(
          `info depth 12 score cp 120 wdl 600 300 100 nodes 30000 time 20 pv ${move}`,
        );
        if (command.startsWith("go depth")) {
          const second = this.ply === 1 ? "d2d4" : "c7c5";
          send(
            `info depth 12 multipv 2 score cp 75 nodes 31000 time 21 pv ${second}`,
          );
        }
        send(`bestmove ${move}`);
      }
    });
  }
}

function evidenceAt(ply: number) {
  const value = completedAnalysis.evidence[0];
  if (!value) throw new Error("Missing fixture");
  if (ply === 1) return value;
  const step = twoPlyGame.positions[2];
  if (!step) throw new Error("Missing position");
  const line = {
    ...value.played,
    score: { kind: "cp", centipawns: -120, pov: "white" },
    mover_score: { kind: "cp", centipawns: 120, pov: "black" },
    wdl: { wins: 600, draws: 300, losses: 100, pov: "black" },
    pv: [{ san: "e5", uci: "e7e5", fen: step.fen }],
  };
  return {
    ...value,
    ply: 2,
    before_ply: 1,
    mover: "black",
    played_uci: "e7e5",
    root_fen: imported.positions[1]?.fen,
    best: [line],
    played: line,
  };
}

export function fakePorts() {
  FakeWorker.active.clear();
  FakeWorker.commands = [];
  FakeWorker.roots = [];
  FakeWorker.held = false;
  FakeWorker.alternative = false;
  const factory = new IDBFactory();
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("indexedDB", factory);
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
    if (!_url.endsWith("/browser-evidence"))
      throw new Error("Unexpected network request");
    const input: unknown = JSON.parse(String(options?.body));
    const positions = array(object(input).positions, 8);
    return Response.json({
      trust: "client_unverified",
      evidence: positions.map((item) =>
        evidenceAt(integer(object(item).ply, 1, 2)),
      ),
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return { factory, fetcher };
}
