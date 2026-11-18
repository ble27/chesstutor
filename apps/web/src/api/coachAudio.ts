import type { paths } from "./generated";

const audioPath: keyof paths =
  "/api/v1/analyses/{analysis_id}/lessons/{ply}/audio";

export async function fetchCoachAudio(
  id: string,
  ply: number,
  signal: AbortSignal,
): Promise<Blob> {
  const path = audioPath
    .replace("{analysis_id}", encodeURIComponent(id))
    .replace("{ply}", String(ply));
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (
    !response.ok ||
    response.headers.get("Content-Type")?.split(";")[0] !== "audio/mpeg"
  )
    throw new Error("Coach voice unavailable");
  const clip = await response.blob();
  if (clip.size === 0 || clip.size > 256 * 1024)
    throw new Error("Coach voice unavailable");
  return clip;
}
