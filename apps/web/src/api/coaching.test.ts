import { expect, it } from "vitest";
import { answer, lessons } from "../testFixtures/coaching";
import { parseCoach, parseLessons } from "./coaching";

const clone = <T>(value: T): T => structuredClone(value);
const first = (value: typeof lessons) => {
  const lesson = value.lessons[0];
  if (!lesson) throw new Error("Missing fixture");
  return lesson;
};

it("accepts server lessons and coach answers", () => {
  expect(parseLessons(lessons).lessons[0]?.kind).toBe("mistake");
  expect(parseCoach(answer).status).toBe("grounded");
});

it("rejects lessons that break the contract", () => {
  const badKind = clone(lessons);
  first(badKind).kind = "decent" as never;
  const badSquare = clone(lessons);
  const arrow = first(badSquare).arrows[0];
  if (arrow) arrow.from_square = "z9";
  const tooMany = clone(lessons);
  const alternative = first(tooMany).alternatives[0];
  if (alternative)
    first(tooMany).alternatives = [alternative, alternative, alternative];
  const longText = clone(lessons);
  first(longText).text = "x".repeat(801);
  const badPly = clone(lessons);
  first(badPly).ply = 0;
  for (const value of [badKind, badSquare, tooMany, longText, badPly])
    expect(() => parseLessons(value)).toThrow();
  expect(() => parseLessons({ ...lessons, level: "expert" })).toThrow();
  expect(() => parseLessons({ ...lessons, lessons: "none" })).toThrow();
});

it("rejects coach answers with unknown status, unsafe arrows or oversized text", () => {
  expect(() => parseCoach({ ...answer, status: "maybe" })).toThrow();
  expect(() => parseCoach({ ...answer, text: "x".repeat(1501) })).toThrow();
  expect(() =>
    parseCoach({
      ...answer,
      arrows: [
        {
          kind: "suggested",
          rank: 1,
          from_square: "a1",
          to_square: "<b>",
          uci: "a1b2",
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseCoach({ ...answer, continuation_uci: ["not-a-move"] }),
  ).toThrow();
});

it.each(["good", "best", "forced", "inaccuracy", "unclassified"])(
  "accepts selected-ply %s notes",
  (kind) => {
    const note = lessons.lessons[0];
    if (!note) throw new Error("Missing note");
    expect(
      parseLessons({ ...lessons, lessons: [{ ...note, kind }] }).lessons[0]
        ?.kind,
    ).toBe(kind);
  },
);
