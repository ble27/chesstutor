import { useEffect, useRef, useState } from "react";
import type { Analysis } from "../../api/analysis";
import type { Lesson, Level } from "../../api/coaching";
import type { Evidence } from "../../api/analysisEvidence";
import type { LessonState } from "../guidance/useGuidance";
import { useLessons } from "../guidance/useGuidance";
import { arrowDescription, toBoardArrows } from "../guidance/arrows";
import type { BoardArrow } from "../guidance/arrows";
import { LabelLoss } from "../guidance/LabelLoss";
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
  const [level, setLevel] = useState<Level>("beginner");
  const [revision, setRevision] = useState(0);
  const [fallbackArrows, setFallbackArrows] = useState(true);
  const showArrows = arrowsVisible ?? fallbackArrows;
  const setShowArrows = onArrowsVisible ?? setFallbackArrows;
  const state = useLessons(analysis, level, revision);
  const move = analysis?.evidence.find((item) => item.ply === selectedPly);
  const lesson =
    state.status === "ready" && move
      ? state.lessons.lessons.find((item) => item.ply === selectedPly)
      : undefined;
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    const region = content.current?.closest(".workspace-coach");
    if (region) region.scrollTop = 0;
  }, [selectedPly]);
  useEffect(() => {
    onArrows(
      !suspended && showArrows && lesson && move
        ? toBoardArrows(lesson.arrows, move)
        : [],
    );
    return () => onArrows([]);
  }, [suspended, showArrows, lesson, move, onArrows]);
  return (
    <section className="npc-coach" aria-label="Move coach" ref={content}>
      <img
        className="coach-avatar"
        src="/coach/tutor.png"
        width="72"
        height="88"
        alt=""
      />
      <div className="coach-lesson">
        <h2>Your move coach</h2>
        <CoachText
          analysis={analysis}
          selectedPly={selectedPly}
          move={move}
          lesson={lesson}
          state={state}
          retry={() => setRevision((v) => v + 1)}
        />
        <CoachVoice
          text={suspended ? "" : (lesson?.text ?? "")}
          context={`${analysis?.id}:${selectedPly}:${level}`}
        />
        <details className="coach-options">
          <summary>Coach options and alternatives</summary>
          <label>
            Explanation level
            <select
              value={level}
              onChange={(event) =>
                setLevel(
                  event.target.value === "intermediate"
                    ? "intermediate"
                    : "beginner",
                )
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
            </select>
          </label>
          <LabelLoss
            review={analysis?.classifications?.find(
              (item) => item.ply === selectedPly,
            )}
          />
          {lesson && (
            <CoachAlternatives
              lesson={lesson}
              move={move}
              showArrows={showArrows}
              setShowArrows={setShowArrows}
            />
          )}
        </details>
      </div>
    </section>
  );
}
function CoachAlternatives({
  lesson,
  move,
  showArrows,
  setShowArrows,
}: {
  lesson: Lesson;
  move: Evidence | undefined;
  showArrows: boolean;
  setShowArrows: (value: boolean) => void;
}) {
  return (
    <>
      {lesson.alternatives.length > 0 && (
        <ul aria-label="Suggested moves">
          {lesson.alternatives.map((item) => (
            <li key={item.uci}>{item.text}</li>
          ))}
        </ul>
      )}
      {lesson.arrows.length > 0 && (
        <>
          <label>
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(event) => setShowArrows(event.target.checked)}
            />
            Show arrows on the board
          </label>
          <ul aria-label="Board arrows">
            {lesson.arrows.map((arrow) => (
              <li key={`${arrow.kind}:${arrow.uci}`}>
                {arrowDescription(arrow, move)}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function CoachText({
  analysis,
  selectedPly,
  move,
  lesson,
  state,
  retry,
}: {
  analysis: Analysis | null;
  selectedPly: number;
  move: Evidence | undefined;
  lesson: Lesson | undefined;
  state: LessonState;
  retry: () => void;
}) {
  return (
    <>
      <div aria-live="polite" aria-atomic="true">
        {selectedPly > 0 && move && (
          <p className="move-note-context">
            Ply {selectedPly} · {move.mover === "white" ? "White" : "Black"}{" "}
            move
          </p>
        )}
        {lesson ? (
          <>
            <h3>
              {lesson.kind === "great"
                ? "Great move"
                : lesson.kind === "best"
                  ? "Best move"
                  : lesson.kind[0]?.toUpperCase() + lesson.kind.slice(1)}
            </h3>
            <p>{lesson.text}</p>
          </>
        ) : (
          <p>
            {!analysis
              ? "Run a review to get chess guidance for the moves in this game."
              : selectedPly === 0
                ? "Select a move to see its note."
                : state.status === "loading"
                  ? "Loading move notes…"
                  : "This move has no reliable explanation yet."}
          </p>
        )}
      </div>
      {state.status === "error" && (
        <div role="alert">
          <p>{state.error.message}</p>
          {state.error.retryable && (
            <button onClick={retry}>Retry move notes</button>
          )}
        </div>
      )}
      {state.status === "ready" && !state.lessons.complete && (
        <p>Analysis incomplete; some notes may be unavailable.</p>
      )}
    </>
  );
}
