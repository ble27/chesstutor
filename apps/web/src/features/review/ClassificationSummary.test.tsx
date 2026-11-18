import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { verifiedGreatAnalysis } from "../../testFixtures/analysis";
import { imported } from "../../testFixtures/discovery";
import { ClassificationSummary } from "./ClassificationSummary";

const summary = verifiedGreatAnalysis.summary;
if (!summary) throw new Error("Missing summary fixture");

it("compares both named players with one primary label per ply including zero counts", () => {
  render(
    <ClassificationSummary
      summary={summary}
      reviews={verifiedGreatAnalysis.classifications}
      players={imported.game}
    />,
  );
  const table = screen.getByRole("table", {
    name: "Move classifications by player",
  });
  expect(
    within(table).getByRole("columnheader", { name: /alice.*White/ }),
  ).toBeVisible();
  expect(
    within(table).getByRole("columnheader", { name: /bobby.*Black/ }),
  ).toBeVisible();
  expect(
    within(table).getByRole("row", { name: /Great move 1 0/ }),
  ).toBeVisible();
  expect(
    within(table).getByRole("row", { name: /Best move 0 0/ }),
  ).toBeVisible();
  expect(
    within(table).getByRole("row", { name: /Unclassified 0 0/ }),
  ).toBeVisible();
  expect(
    within(table).getByRole("row", { name: /Total reviewed plies 1 0/ }),
  ).toBeVisible();
});

it("labels independent accuracy and keeps unscored players unavailable", () => {
  render(<ClassificationSummary summary={summary} />);
  const table = screen.getByRole("table", {
    name: "Move classifications by player",
  });
  expect(
    within(table).getByRole("row", {
      name: /Chess Tutor accuracy Unavailable Unavailable/,
    }),
  ).toBeVisible();
  expect(screen.queryByText("How these numbers work")).not.toBeInTheDocument();
  expect(
    within(table).getByRole("row", { name: /Scored plies 0 0/ }),
  ).toBeVisible();
});

it("does not infer calibrated accuracy from legacy average-loss summaries", () => {
  render(
    <ClassificationSummary
      summary={{
        ...summary,
        is_final: false,
        players: {
          white: {
            counts: {
              good: 29,
              best: 15,
              inaccuracy: 4,
              mistake: 4,
              blunder: 4,
              unclassified: 2,
            },
            average_expected_loss: 0.072,
          },
          black: {
            counts: {
              good: 28,
              best: 18,
              inaccuracy: 4,
              mistake: 6,
              blunder: 1,
              forced: 1,
            },
            average_expected_loss: 0.066,
          },
        },
      }}
    />,
  );
  const table = screen.getByRole("table", {
    name: "Move classifications by player",
  });
  expect(
    within(table).getByRole("row", {
      name: /Chess Tutor accuracy Unavailable Unavailable/,
    }),
  ).toBeVisible();
  expect(
    within(table).getByRole("row", { name: /Scored plies 0 0/ }),
  ).toBeVisible();
  expect(screen.getByText(/Summary so far/)).toBeVisible();
});
