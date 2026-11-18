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
        text={text}
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
  text,
  muted,
}: {
  analysisId: string | undefined;
  ply: number;
  text: string | undefined;
  muted: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const source = useRef<string>(null);
  const request = useRef<AbortController>(null);
  const [state, setState] = useState<Playback>("idle");
  const speech = useDeviceVoice(state, setState, muted);
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
    if (!analysisId || !text || !player || request.current) return;
    if (state === "playing") {
      if (speech.used) speech.pause();
      else player.pause();
      setState("paused");
      return;
    }
    if (speech.used) {
      speech.play(text);
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
      if (!controller.signal.aborted) speech.play(text);
    } finally {
      request.current = null;
    }
  }

  return (
    <>
      <audio ref={audio} muted={muted} onEnded={() => setState("idle")} />
      <button
        disabled={!analysisId || muted || state === "loading"}
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
      {speech.used && state !== "unavailable" && (
        <span className="voice-error" role="status">
          Device voice
        </span>
      )}
      {state === "unavailable" && (
        <span className="voice-error" role="status">
          Voice unavailable
        </span>
      )}
    </>
  );
}

function useDeviceVoice(
  state: Playback,
  setState: (state: Playback) => void,
  muted: boolean,
) {
  const speech = useRef<SpeechSynthesisUtterance>(null);
  const [used, setDevice] = useState(false);
  useEffect(
    () => () => {
      if (!speech.current) return;
      speech.current.onend = null;
      speech.current.onerror = null;
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    if (speech.current && muted) window.speechSynthesis?.pause();
    if (speech.current && !muted && state === "playing")
      window.speechSynthesis?.resume();
  }, [muted, state]);

  function playDevice(note: string) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      setState("unavailable");
      return;
    }
    if (speech.current) {
      synth.resume();
      setState("playing");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(note);
    utterance.lang = "en-US";
    utterance.voice =
      synth
        .getVoices()
        .find((voice) => voice.localService && voice.lang.startsWith("en")) ??
      null;
    utterance.rate = 0.94;
    utterance.onend = () => {
      speech.current = null;
      setState("idle");
    };
    utterance.onerror = () => {
      speech.current = null;
      setState("unavailable");
    };
    speech.current = utterance;
    setDevice(true);
    setState("playing");
    synth.speak(utterance);
  }

  return {
    used,
    play: playDevice,
    pause: () => window.speechSynthesis?.pause(),
  };
}
