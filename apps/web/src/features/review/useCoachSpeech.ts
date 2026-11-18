import { useEffect, useState } from "react";

export function useCoachSpeech(text: string, context: string) {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const update = () =>
      setAvailable(
        synth
          .getVoices()
          .some((voice) => voice.localService && voice.lang.startsWith("en")),
      );
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (enabled && available && text) {
      const voice = synth
        .getVoices()
        .find((voice) => voice.localService && voice.lang.startsWith("en"));
      if (voice) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.rate = 0.95;
        synth.speak(utterance);
      }
    }
    return () => synth.cancel();
  }, [text, context, enabled, available, replay]);
  return {
    enabled,
    setEnabled,
    available,
    replay: () => setReplay((value) => value + 1),
  };
}
