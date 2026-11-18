import type { Game } from "../../api/discoveryValidation";
import { engineScript, prepareEngine } from "../../api/browserEngineAssets";
import { parseInfo } from "./uci";
import type { RawLine } from "./uci";

export class BrowserEngine {
  private worker: Worker;
  private signal: AbortSignal;
  private abort = () => this.close();
  constructor(build: "single-a496a04" | "8e4d048", signal: AbortSignal) {
    this.worker = new Worker(`/engine/${engineScript(build)}`);
    this.signal = signal;
    signal.addEventListener("abort", this.abort, { once: true });
    if (signal.aborted) this.close();
  }
  close() {
    this.signal.removeEventListener("abort", this.abort);
    this.worker.terminate();
  }

  private command(
    command: string,
    finish: (line: string) => boolean,
    signal: AbortSignal,
    timeout: number,
    info?: (line: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", aborted);
        this.worker.onmessage = null;
        this.worker.onerror = null;
      };
      const fail = (message: string) => {
        cleanup();
        this.close();
        reject(new Error(message));
      };
      const aborted = () => fail("Analysis cancelled.");
      const timer = setTimeout(
        () => fail("Browser engine deadline exceeded."),
        timeout,
      );
      signal.addEventListener("abort", aborted, { once: true });
      if (signal.aborted) {
        aborted();
        return;
      }
      this.worker.onerror = () =>
        fail("Browser engine unavailable on this device.");
      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") {
          fail("Invalid engine message.");
          return;
        }
        for (const line of event.data.split("\n")) {
          info?.(line);
          if (finish(line)) {
            cleanup();
            resolve();
            return;
          }
        }
      };
      this.worker.postMessage(command);
    });
  }
  async ready(threads: number, signal: AbortSignal) {
    await this.command("uci", (line) => line === "uciok", signal, 30000);
    for (const option of [
      `Threads value ${threads}`,
      "Hash value 128",
      "MultiPV value 1",
      "UCI_ShowWDL value true",
    ])
      this.worker.postMessage(`setoption name ${option}`);
    await this.command("isready", (line) => line === "readyok", signal, 10000);
    this.worker.postMessage("ucinewgame");
  }
  async searchPosition(
    initialFen: string,
    moves: readonly string[],
    depth: number,
    signal: AbortSignal,
    update: (line: RawLine) => void,
  ): Promise<RawLine> {
    if (!Number.isInteger(depth) || depth < 1 || depth > 40)
      throw new Error("Invalid local depth");
    if (moves.some((move) => !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)))
      throw new Error("Invalid position history");
    this.worker.postMessage(
      `position fen ${initialFen}${moves.length ? ` moves ${moves.join(" ")}` : ""}`,
    );
    let latest: RawLine | null = null;
    await this.command(
      `go depth ${depth} movetime 9500`,
      (line) => line.startsWith("bestmove "),
      signal,
      10500,
      (message) => {
        const line = parseInfo(message);
        if (line && !line.bounded) {
          latest = line;
          update(line);
        }
      },
    );
    if (!latest) throw new Error("No complete local engine line was returned.");
    return latest;
  }

  async search(
    game: Game,
    ply: number,
    nodes: number,
    played: boolean,
    signal: AbortSignal,
  ): Promise<RawLine> {
    const moves = game.positions
      .slice(1, ply)
      .map((position) => position.uci)
      .join(" ");
    this.worker.postMessage(
      `position fen ${game.initial_fen}${moves ? ` moves ${moves}` : ""}`,
    );
    const restriction = played
      ? ` searchmoves ${game.positions[ply]?.uci}`
      : "";
    let latest: RawLine | null = null;
    await this.command(
      `go nodes ${nodes} movetime ${nodes > 30000 ? 1500 : 250}${restriction}`,
      (line) => line.startsWith("bestmove "),
      signal,
      10000,
      (line) => {
        const parsed = parseInfo(line);
        if (parsed) latest = parsed;
      },
    );
    if (!latest)
      throw new Error("Engine returned no complete evidence for this move.");
    return latest;
  }
}

export async function openBrowserEngine(
  threads: number,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  if (typeof WebAssembly === "undefined" || typeof Worker === "undefined")
    throw new Error("WebAssembly workers are unavailable on this browser.");
  const build = threads > 1 ? "8e4d048" : "single-a496a04";
  await prepareEngine(build, signal, progress);
  progress("Starting full Stockfish 17.1…");
  const engine = new BrowserEngine(build, signal);
  try {
    await engine.ready(threads, signal);
    return engine;
  } catch (error) {
    engine.close();
    throw error;
  }
}
