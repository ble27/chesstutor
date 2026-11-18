import { useEffect, useState } from "react";
import type { Lesson } from "../../api/coaching";
import type { Analysis } from "../../api/analysis";
import { useLessons } from "../guidance/useGuidance";
import { arrowDescription, toBoardArrows } from "../guidance/arrows";
import type { BoardArrow } from "../guidance/arrows";
import { CheckField } from "../../components/ui/Checkbox";
import { moveRating } from "./summaryPresentation";
import { CoachVoice } from "./CoachVoice";

export function CoachPanel({
  analysis,
  selectedPly,
  selectedSan,
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
  selectedSan?: string | undefined;
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
  const rating = moveRating(
    analysis?.classifications?.find((item) => item.ply === selectedPly),
    lesson?.kind,
  );
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
        <CoachResponse
          move={suspended ? undefined : selectedSan}
          rating={selectedPly > 0 && !suspended ? rating : null}
          lesson={lesson}
          state={state}
          selectedPly={selectedPly}
          suspended={suspended}
        />
        {lesson && lesson.arrows.length > 0 && (
          <>
            <CheckField
              label="Board arrows"
              checked={showArrows}
              onChange={setShowArrows}
            />
            {showArrows && (
              <span className="visually-hidden">
                {lesson.arrows
                  .map((arrow) => arrowDescription(arrow, move))
                  .join(". ")}
              </span>
            )}
          </>
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

function CoachResponse({
  move,
  rating,
  lesson,
  state,
  selectedPly,
  suspended,
}: {
  move: string | undefined;
  rating: ReturnType<typeof moveRating> | null;
  lesson: Lesson | undefined;
  state: ReturnType<typeof useLessons>;
  selectedPly: number;
  suspended: boolean;
}) {
  const alternative = lesson?.alternatives[0];
  const status = suspended
    ? "Return to the recorded move for its note."
    : selectedPly === 0
      ? "Starting position"
      : state.status === "error"
        ? state.error.message
        : state.status === "loading"
          ? "Loading move note…"
          : null;
  return (
    <div className="coach-response">
      {rating && (
        <div className="coach-response-heading">
          {move && <strong className="coach-move">{move}</strong>}
          <span className="coach-rating" data-rating={rating.kind}>
            {rating.name}
          </span>
        </div>
      )}
      <p
        aria-live="polite"
        role={state.status === "error" && !suspended ? "alert" : undefined}
        className="coach-note"
      >
        {lesson ? <HighlightedNote text={lesson.text} /> : status}
      </p>
      {alternative && (
        <p className="coach-alternative">
          <strong>Try instead</strong>{" "}
          <HighlightedNote text={alternative.text} />
        </p>
      )}
    </div>
  );
}

function HighlightedNote({ text }: { text: string }) {
  const parts = text.split(
    /(\b[a-h][1-8]\b|\b(?:bishop|king|knight|pawn|queen|rook)s?\b)/gi,
  );
  return parts.map((part, index) =>
    index % 2 === 0 ? part : <strong key={index}>{part}</strong>,
  );
}
