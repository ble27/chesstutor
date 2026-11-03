import { object, text } from "./analysisFields";
import manifest from "../../../../engines/stockfish-browser.json";

export type Build = "single-a496a04" | "8e4d048";
export const engineScript = (build: Build) => `stockfish-17.1-${build}.js`;

async function download(
  name: string,
  hash: string,
  signal: AbortSignal,
  progress: (bytes: number) => void,
) {
  const response = await fetch(`/engine/${name}`, {
    signal,
    cache: "force-cache",
  });
  if (!response.ok || !response.body)
    throw new Error("Engine download unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Oversized engine asset.");
    }
    chunks.push(new Uint8Array(value));
    progress(value.byteLength);
  }
  const data = await new Blob(chunks).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  if (actual !== hash) throw new Error("Engine download checksum mismatch.");
}

export async function prepareEngine(
  build: Build,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const response = await fetch("/engine/provenance.json", {
    signal,
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error(
      "Engine download unavailable. Prepare browser engine assets first.",
    );
  const input: unknown = await response.json();
  const provenance = object(input),
    files = object(provenance.files);
  if (
    provenance.artifact_id !== manifest.artifact_id ||
    provenance.package !== "stockfish@17.1.0" ||
    provenance.quality !== "full"
  )
    throw new Error("Unexpected engine provenance.");
  const names = [
    engineScript(build),
    ...Array.from(
      { length: 6 },
      (_, index) => `stockfish-17.1-${build}-part-${index}.wasm`,
    ),
  ];
  let bytes = 0;
  for (const name of names) {
    const hash = text(files[name], 64);
    const pinnedFiles: Record<string, string> = manifest.files;
    if (hash !== pinnedFiles[name]) throw new Error("Unpinned engine asset.");
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new Error("Invalid engine checksum.");
    await download(name, hash, signal, (count) => {
      bytes += count;
      progress(
        `Loading full engine: ${(bytes / 1048576).toFixed(1)} MiB (download or browser cache)`,
      );
    });
  }
}
