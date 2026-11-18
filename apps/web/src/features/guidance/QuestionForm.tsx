import { SelectField } from "../../components/ui/Select";
import { useState } from "react";
import type { FormEvent } from "react";
import type { CoachRequest, Intent, Level } from "../../api/coaching";
import type { AnswerState } from "./useGuidance";

type Color = "white" | "black";
const QUESTIONS: readonly (readonly [Intent, string])[] = [
  ["explain_move", "Explain this move"],
  ["better_move", "Show a better move"],
  ["opponent_threat", "What is the opponent threatening?"],
  ["position_plan", "What is a good plan?"],
  ["explain_chess_rule", "Explain a chess rule"],
  ["game_improvement", "How can I improve in this game?"],
];

type Props = {
  ply: number;
  mover: Color | null;
  level: Level;
  ask: (request: CoachRequest) => void;
  state: AnswerState;
};

export function QuestionForm({ ply, mover, level, ask, state }: Props) {
  const [advisee, setAdvisee] = useState<Color | null>(null);
  const [question, setQuestion] = useState("");
  const color = advisee ?? mover;
  const ready = mover !== null && color !== null && state.status !== "asking";
  const send = (extra: Pick<CoachRequest, "intent" | "question">) => {
    if (color) ask({ ply, player_color: color, level, ...extra });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (text) send({ question: text });
  };
  return (
    <section aria-labelledby="coach-questions-title">
      <h3 id="coach-questions-title">Ask the coach</h3>
      <SelectField
        label="Advice for"
        value={color ?? "white"}
        onChange={(value) => setAdvisee(value === "black" ? "black" : "white")}
        options={[
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ]}
      />
      <div className="suggested-questions">
        {QUESTIONS.map(([intent, label]) => (
          <button
            key={intent}
            type="button"
            disabled={!ready}
            onClick={() => send({ intent })}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} aria-busy={state.status === "asking"}>
        <label htmlFor="coach-question">Ask a chess question</label>
        <textarea
          id="coach-question"
          maxLength={1000}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" disabled={!ready || question.trim() === ""}>
          Ask
        </button>
      </form>
      <Answer state={state} retry={ask} />
    </section>
  );
}

function Answer({
  state,
  retry,
}: {
  state: AnswerState;
  retry: (request: CoachRequest) => void;
}) {
  return (
    <>
      <div role="status" aria-live="polite" className="coach-answer">
        {state.status === "asking" && <p>Thinking about this position…</p>}
        {state.status === "answered" && <p>{state.answer.text}</p>}
      </div>
      {state.status === "error" && (
        <div role="alert">
          <p>{state.error.message}</p>
          <button type="button" onClick={() => retry(state.request)}>
            Try again
          </button>
        </div>
      )}
    </>
  );
}
