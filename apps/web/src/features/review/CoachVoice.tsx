import { useCoachSpeech } from "./useCoachSpeech";
export function CoachVoice({
  text,
  context,
}: {
  text: string;
  context: string;
}) {
  const speech = useCoachSpeech(text, context);
  return (
    <div className="coach-voice">
      <label>
        <input
          type="checkbox"
          checked={speech.enabled}
          onChange={(event) => speech.setEnabled(event.target.checked)}
        />
        Coach voice
      </label>
      {speech.enabled ? (
        <>
          <button disabled={!speech.available || !text} onClick={speech.replay}>
            Replay voice
          </button>
          {!speech.available && (
            <p role="status">
              No local English voice is available. Text remains available.
            </p>
          )}
        </>
      ) : (
        <span>Continuous text only</span>
      )}
    </div>
  );
}
