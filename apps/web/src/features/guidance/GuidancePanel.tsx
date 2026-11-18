import { useEffect, useState } from "react";
import type { Analysis } from "../../api/analysis";
import type { Evidence } from "../../api/analysisEvidence";
import type { Lesson, Level } from "../../api/coaching";
import { arrowDescription, toBoardArrows } from "./arrows";
import type { BoardArrow } from "./arrows";
import { QuestionForm } from "./QuestionForm";
import { LabelLoss } from "./LabelLoss";
import { useCoach, useLessons } from "./useGuidance";
import type { LessonState } from "./useGuidance";

type Props = {
  analysis: Analysis | null;
  selectedPly: number;
  onArrows: (arrows: BoardArrow[]) => void;
};

const KIND_LABEL: Record<Lesson["kind"], string> = {
  miss: "Miss",
  mistake: "Mistake",
  blunder: "Blunder",
  great: "Great move",
  brilliant: "Brilliant",
  good: "Good",
  best: "Best move",
  inaccuracy: "Inaccuracy",
  forced: "Forced",
  unclassified: "Unclassified",
};

export function GuidancePanel({ analysis, selectedPly, onArrows }: Props) {
  const [level, setLevel] = useState<Level>("beginner");
  const [showArrows, setShowArrows] = useState(true);
  const [noteRevision, setNoteRevision] = useState(0);
  const lessons = useLessons(analysis, level, noteRevision);
  const coach = useCoach(analysis);
  const { reset } = coach;
  const move = analysis?.evidence.find((item) => item.ply === selectedPly);
  const lesson =
    lessons.status === "ready"
      ? lessons.lessons.lessons.find((item) => item.ply === selectedPly)
      : undefined;
  useEffect(() => {
    onArrows(
      showArrows && lesson && move ? toBoardArrows(lesson.arrows, move) : [],
    );
    return () => onArrows([]);
  }, [lesson, move, showArrows, onArrows]);
  useEffect(() => reset(), [selectedPly, level, reset]);
  if (!analysis)
    return (
      <p>Run a review to get chess guidance for the moves in this game.</p>
    );
  return (
    <div className="guidance">
      <LevelChoice level={level} choose={setLevel} />
      <MoveNote
        state={lessons}
        retry={() => setNoteRevision((value) => value + 1)}
        lesson={lesson}
        selectedPly={selectedPly}
        analyzed={move !== undefined}
        showArrows={showArrows}
        setShowArrows={setShowArrows}
        evidence={move}
      />
      <LabelLoss
        review={analysis.classifications?.find(
          (item) => item.ply === selectedPly,
        )}
      />
      <QuestionForm
        ply={selectedPly}
        mover={move?.mover ?? null}
        level={level}
        ask={coach.ask}
        state={coach.state}
      />
    </div>
  );
}

function LevelChoice({
  level,
  choose,
}: {
  level: Level;
  choose: (level: Level) => void;
}) {
  return (
    <fieldset className="level-choice">
      <legend>Explanation level</legend>
      {(["beginner", "intermediate"] as const).map((item) => (
        <label key={item}>
          <input
            type="radio"
            name="level"
            checked={level === item}
            onChange={() => choose(item)}
          />
          {item === "beginner" ? "Beginner" : "Intermediate"}
        </label>
      ))}
    </fieldset>
  );
}

function MoveNote(props: {
  state: LessonState;
  retry: () => void;
  lesson: Lesson | undefined;
  selectedPly: number;
  analyzed: boolean;
  showArrows: boolean;
  setShowArrows: (value: boolean) => void;
  evidence: Evidence | undefined;
}) {
  const { state, lesson, selectedPly, analyzed } = props;
  if (state.status === "error")
    return (
      <div role="alert">
        <p>{state.error.message}</p>
        {state.error.retryable && (
          <button onClick={props.retry}>Retry move notes</button>
        )}
      </div>
    );
  if (selectedPly === 0) return <p>Select a move to see its note.</p>;
  if (state.status !== "ready") return <p role="status">Loading move notes…</p>;
  if (!analyzed)
    return <p role="status">This move has not been analyzed yet.</p>;
  return (
    <section
      aria-labelledby="move-note-title"
      aria-live="polite"
      aria-atomic="true"
    >
      <h3 id="move-note-title">Move note</h3>
      <p className="move-note-context">
        Ply {selectedPly} ·{" "}
        {props.evidence?.mover === "white" ? "White" : "Black"} move
      </p>
      {!state.lessons.complete && (
        <p>
          This analysis is incomplete, so some move notes may be unavailable.
        </p>
      )}
      {lesson ? (
        <LessonView {...props} lesson={lesson} />
      ) : (
        <p>
          No explanation is available for this move yet. Ask a question below or
          run Deep for more evidence.
        </p>
      )}
    </section>
  );
}

function LessonView({
  lesson,
  showArrows,
  setShowArrows,
  evidence,
}: {
  lesson: Lesson;
  showArrows: boolean;
  setShowArrows: (value: boolean) => void;
  evidence: Evidence | undefined;
}) {
  return (
    <>
      <p className={`lesson-kind lesson-${lesson.kind}`}>
        {KIND_LABEL[lesson.kind]}
      </p>
      <p>{lesson.text}</p>
      {lesson.alternatives.length > 0 && (
        <ul aria-label="Suggested moves">
          {lesson.alternatives.map((item) => (
            <li key={item.uci}>{item.text}</li>
          ))}
        </ul>
      )}
      {lesson.arrows.length > 0 && (
        <label>
          <input
            type="checkbox"
            checked={showArrows}
            onChange={(event) => setShowArrows(event.target.checked)}
          />
          Show arrows on the board
        </label>
      )}
      {lesson.arrows.length > 0 && (
        <ul aria-label="Board arrows">
          {lesson.arrows.map((item) => (
            <li key={`${item.kind}-${item.uci}`}>
              {arrowDescription(item, evidence)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
