export function ReplayControls({
  selectedPly,
  lastPly,
  select,
  flip,
}: {
  selectedPly: number;
  lastPly: number;
  select: (ply: number) => void;
  flip: () => void;
}) {
  return (
    <nav aria-label="Replay controls">
      <button disabled={selectedPly === 0} onClick={() => select(0)}>
        First position
      </button>
      <button
        disabled={selectedPly === 0}
        onClick={() => select(selectedPly - 1)}
      >
        Previous move
      </button>
      <button
        disabled={selectedPly === lastPly}
        onClick={() => select(selectedPly + 1)}
      >
        Next move
      </button>
      <button
        disabled={selectedPly === lastPly}
        onClick={() => select(lastPly)}
      >
        Last position
      </button>
      <button onClick={flip}>Flip board</button>
    </nav>
  );
}
