import { useEffect, useRef, useState } from "react";
import { fetchCoachAudio } from "../../api/coachAudio";

type Playback = "idle" | "loading" | "playing" | "paused" | "unavailable";

export function CoachVoice({
  analysisId,
  ply,
  text,
  muted,
  onMute,
}: {
  analysisId: string | undefined;
  ply: number;
  text: string | undefined;
  muted: boolean;
  onMute: (muted: boolean) => void;
}) {
  return (
    <div className="coach-voice">
      <PlaybackControl
        key={`${analysisId}:${ply}:${text}`}
        analysisId={analysisId}
        ply={ply}
        muted={muted}
      />
      <button
        aria-pressed={muted}
        aria-label="Mute coach"
        onClick={() => onMute(!muted)}
      >
        {muted ? "Muted" : "Mute"}
      </button>
    </div>
  );
}

function PlaybackControl({
  analysisId,
  ply,
  muted,
}: {
  analysisId: string | undefined;
  ply: number;
  muted: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const source = useRef<string>(null);
  const request = useRef<AbortController>(null);
  const [state, setState] = useState<Playback>("idle");
  useEffect(() => {
    const player = audio.current;
    return () => {
      request.current?.abort();
      if (source.current) {
        player?.pause();
        URL.revokeObjectURL(source.current);
        source.current = null;
      }
    };
  }, []);

  async function toggle() {
    const player = audio.current;
    if (!analysisId || !player || request.current) return;
    if (state === "playing") {
      player.pause();
      setState("paused");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setState("loading");
    try {
      if (!source.current) {
        const clip = await fetchCoachAudio(analysisId, ply, controller.signal);
        if (controller.signal.aborted) return;
        source.current = URL.createObjectURL(clip);
        player.src = source.current;
      }
      await player.play();
      if (!controller.signal.aborted) setState("playing");
    } catch {
      if (!controller.signal.aborted) setState("unavailable");
    } finally {
      request.current = null;
    }
  }

  return (
    <>
      <audio ref={audio} muted={muted} onEnded={() => setState("idle")} />
      <button
        disabled={!analysisId || state === "loading"}
        aria-label={
          state === "playing" ? "Pause coach voice" : "Play coach voice"
        }
        onClick={() => void toggle()}
      >
        {state === "playing"
          ? "Pause"
          : state === "loading"
            ? "Loading…"
            : "Play"}
      </button>
      {state === "unavailable" && (
        <span className="voice-error" role="status">
          Voice unavailable
        </span>
      )}
    </>
  );
}
