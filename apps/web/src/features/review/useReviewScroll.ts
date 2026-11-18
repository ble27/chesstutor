import { useEffect, useRef } from "react";

export function useReviewScroll() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const board = host.previousElementSibling;
    const moves = host.querySelector(".moves-module");
    if (!moves) return;
    // Measure panels before the move list so switching scroll mode cannot
    // change the values that decide whether the workspace fits.
    const update = () => {
      const pageTop = window.scrollY;
      const boardEnd = board
        ? board.getBoundingClientRect().bottom + pageTop
        : 0;
      const movesStart = moves.getBoundingClientRect().top + pageTop;
      const minimumMovesHeight = Number.parseFloat(
        getComputedStyle(moves).minHeight,
      );
      host.toggleAttribute(
        "data-page-scroll",
        Math.max(boardEnd, movesStart + minimumMovesHeight) >
          window.innerHeight,
      );
    };

    const observer = new ResizeObserver(update);
    if (board) observer.observe(board);
    for (const module of host.children) {
      if (module !== moves) observer.observe(module);
    }
    update();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return ref;
}
