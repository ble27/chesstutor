import { useEffect, useState } from "react";
import type { Analysis } from "../../api/analysis";
import type { Evidence } from "../../api/analysisEvidence";
import type { Lesson, Level } from "../../api/coaching";
import { arrowDescription, toBoardArrows } from "./arrows";
import type { BoardArrow } from "./arrows";
import { QuestionForm } from "./QuestionForm";
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
};

export function GuidancePanel({ analysis, selectedPly, onArrows }: Props) {
  const [level, setLevel] = useState<Level>("beginner");
  const [showArrows, setShowArrows] = useState(true);
  const lessons = useLessons(analysis, level);
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
        lesson={lesson}
        selectedPly={selectedPly}
        analyzed={move !== undefined}
        showArrows={showArrows}
        setShowArrows={setShowArrows}
        evidence={move}
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
  lesson: Lesson | undefined;
  selectedPly: number;
  analyzed: boolean;
  showArrows: boolean;
  setShowArrows: (value: boolean) => void;
  evidence: Evidence | undefined;
}) {
  const { state, lesson, selectedPly, analyzed } = props;
  if (state.status === "error")
    return <p role="alert">{state.error.message}</p>;
  if (selectedPly === 0) return <p>Select a move to see its note.</p>;
  if (state.status !== "ready") return <p>Loading move notes…</p>;
  if (!analyzed) return <p>This move has not been analyzed yet.</p>;
  return (
    <section aria-labelledby="move-note-title">
      <h3 id="move-note-title">Move note</h3>
      {!state.lessons.complete && (
        <p>The analysis is still running, so notes may be incomplete.</p>
      )}
      {lesson ? (
        <LessonView {...props} lesson={lesson} />
      ) : (
        <p>
          This move was not flagged. Ask a question below to understand it
          better.
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
      <label>
        <input
          type="checkbox"
          checked={showArrows}
          onChange={(event) => setShowArrows(event.target.checked)}
        />
        Show arrows on the board
      </label>
      <ul aria-label="Board arrows">
        {lesson.arrows.map((item) => (
          <li key={`${item.kind}-${item.uci}`}>
            {arrowDescription(item, evidence)}
          </li>
        ))}
      </ul>
    </>
  );
}
