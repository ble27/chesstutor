import { useState } from "react";

type ReplayPosition = {
  selectedPly: number;
  fen: string;
  orientation: "white" | "black";
};
export type VariationLine = {
  triggerId?: string;
  rootPly: number;
  rootFen: string;
  positions: readonly { fen: string; san: string; uci: string }[];
};
type Preview = {
  origin: string;
  line: VariationLine;
  step: number;
};

export function useVariation(input: ReplayPosition) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [flipped, setFlipped] = useState(false);
  const origin = `${input.selectedPly}:${input.fen}`;
  const current = preview?.origin === origin ? preview : null;
  const step = current?.step ?? 0;
  const position = current?.line.positions[step - 1];
  const select = (index: number) =>
    setPreview((value) =>
      value?.origin === origin
        ? {
            ...value,
            step: Math.max(0, Math.min(value.line.positions.length, index)),
          }
        : null,
    );
  return {
    kind: current ? ("variation" as const) : ("game" as const),
    selectedPly: input.selectedPly,
    orientation: flipped
      ? input.orientation === "white"
        ? ("black" as const)
        : ("white" as const)
      : input.orientation,
    fen: current ? (position?.fen ?? current.line.rootFen) : input.fen,
    lastMove: position?.uci ?? null,
    san: position?.san ?? null,
    rootPly: current?.line.rootPly ?? input.selectedPly,
    triggerId: current?.line.triggerId,
    step,
    length: current?.line.positions.length ?? 0,
    enter: (line: VariationLine) => {
      if (line.positions.length > 0) setPreview({ origin, line, step: 0 });
    },
    select,
    next: () => select(step + 1),
    previous: () => select(step - 1),
    exit: () => setPreview(null),
    flip: () => setFlipped((value) => !value),
  };
}

export type Variation = ReturnType<typeof useVariation>;
