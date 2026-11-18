import { useState } from "react";
import type { KeyboardEvent } from "react";

export function useReplay(lastPly: number) {
  const [selectedPly, setSelectedPly] = useState(0);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const select = (ply: number) =>
    setSelectedPly(Math.max(0, Math.min(lastPly, ply)));
  const flip = () =>
    setOrientation((color) => (color === "white" ? "black" : "white"));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) =>
    replayKeyDown(event, selectedPly, lastPly, select);
  return { selectedPly, select, orientation, flip, onKeyDown };
}

export function replayKeyDown(
  event: KeyboardEvent<HTMLElement>,
  selectedPly: number,
  lastPly: number,
  select: (ply: number) => void,
) {
  if (
    event.defaultPrevented ||
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
      '[role=tablist], [role=dialog], [role=combobox], [role=listbox], [data-board-input], dialog, input, textarea, select, [contenteditable]:not([contenteditable="false"])',
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
}
