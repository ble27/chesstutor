import { useEffect, useState } from "react";
import type { Analysis } from "../../api/analysis";
import { useLessons } from "../guidance/useGuidance";
import { arrowDescription, toBoardArrows } from "../guidance/arrows";
import type { BoardArrow } from "../guidance/arrows";
import { CoachVoice } from "./CoachVoice";

export function CoachPanel({
  analysis,
  selectedPly,
  onArrows,
  suspended = false,
  arrowsVisible,
  onArrowsVisible,
}: {
  suspended?: boolean;
  arrowsVisible?: boolean | undefined;
  onArrowsVisible?: ((visible: boolean) => void) | undefined;
  analysis: Analysis | null;
  selectedPly: number;
  onArrows: (arrows: BoardArrow[]) => void;
}) {
  const [muted, setMuted] = useState(false);
  const [revision, setRevision] = useState(0);
  const [fallbackArrows, setFallbackArrows] = useState(true);
  const showArrows = arrowsVisible ?? fallbackArrows;
  const setShowArrows = onArrowsVisible ?? setFallbackArrows;
  const state = useLessons(analysis, "beginner", revision);
  const move = analysis?.evidence.find((item) => item.ply === selectedPly);
  const lesson =
    !suspended && state.status === "ready" && move
      ? state.lessons.lessons.find((item) => item.ply === selectedPly)
      : undefined;
  useEffect(() => {
    onArrows(
      showArrows && lesson && move ? toBoardArrows(lesson.arrows, move) : [],
    );
    return () => onArrows([]);
  }, [showArrows, lesson, move, onArrows]);

  return (
    <section className="panel coach-module" aria-label="Move coach">
      <img
        className="coach-avatar"
        src="/coach/knight.png"
        width="52"
        height="52"
        alt=""
      />
      <div className="coach-lesson">
        <div className="module-heading">
          <h2>Coach</h2>
          <CoachVoice
            analysisId={lesson ? analysis?.id : undefined}
            ply={selectedPly}
            text={lesson?.text}
            muted={muted}
            onMute={setMuted}
          />
        </div>
        <p
          aria-live="polite"
          role={state.status === "error" && !suspended ? "alert" : undefined}
          className="coach-note"
        >
          {lesson?.text ??
            (suspended
              ? "Recorded moves only"
              : selectedPly === 0
                ? "Starting position"
                : state.status === "error"
                  ? state.error.message
                  : state.status === "loading"
                    ? "Loading move note…"
                    : "No move note")}
        </p>
        {lesson && lesson.arrows.length > 0 && (
          <label className="coach-arrows">
            <input
              type="checkbox"
              aria-label="Board arrows"
              checked={showArrows}
              onChange={(event) => setShowArrows(event.target.checked)}
            />
            Board arrows
            {showArrows && (
              <span className="visually-hidden">
                {lesson.arrows
                  .map((arrow) => arrowDescription(arrow, move))
                  .join(". ")}
              </span>
            )}
          </label>
        )}
        {!suspended && state.status === "error" && state.error.retryable && (
          <button onClick={() => setRevision((value) => value + 1)}>
            Retry move notes
          </button>
        )}
      </div>
    </section>
  );
}
