import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProofEvidence } from "./ProofEvidence";

const verifiedMove = {
  ply: 1,
  badges: ["great"],
  proofs: [
    {
      id: "v1:1:great",
      ply: 1,
      badge: "great",
      motif: "unique_move",
      line: { pv: [{ san: "d4" }] },
    },
  ],
};
const themes = [{ name: "calculation", supporting_plies: [1] }];

it("shows checked proof and supported practice for the selected move", () => {
  render(<ProofEvidence move={verifiedMove} themes={themes} />);
  expect(screen.getByText("Great", { exact: true })).toBeVisible();
  expect(screen.getByText("Checked supporting line: d4")).toBeVisible();
  expect(screen.getByText("Practice: calculation")).toBeVisible();
  expect(screen.getByText(/Brilliant is a heuristic/)).toBeVisible();
});

it("does not display a badge or theme when proof identity or shape is missing", () => {
  const bad = {
    ...verifiedMove,
    proofs: [{ ...verifiedMove.proofs[0], ply: 2 }],
  };
  render(<ProofEvidence move={bad} themes={themes} />);
  expect(screen.queryByText("Great", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText("Practice: calculation")).not.toBeInTheDocument();
});
