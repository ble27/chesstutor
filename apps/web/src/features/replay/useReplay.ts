import { useState } from "react";
import type { KeyboardEvent } from "react";

export function useReplay(lastPly: number) {
  const [selectedPly, setSelectedPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const select = (ply: number) =>
    setSelectedPly(Math.max(0, Math.min(lastPly, ply)));
  const flip = () =>
    setOrientation((color) => (color === "white" ? "black" : "white"));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    const targets: Record<string, number> = {
      ArrowLeft: selectedPly - 1,
      ArrowRight: selectedPly + 1,
      Home: 0,
      End: lastPly,
    };
    const ply = targets[event.key];
    if (ply === undefined) return;
    event.preventDefault();
    select(ply);
  };
  return { selectedPly, select, orientation, flip, onKeyDown };
}
