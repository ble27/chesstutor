const paths = {
  first: "M5 4v16M19 5l-9 7 9 7Z",
  previous: "m16 5-9 7 9 7Z",
  next: "m8 5 9 7-9 7Z",
  last: "M19 4v16M5 5l9 7-9 7Z",
  flip: "M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4",
};
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
  const actions = [
    {
      label: "First position",
      icon: "first",
      disabled: selectedPly === 0,
      run: () => select(0),
    },
    {
      label: "Previous move",
      icon: "previous",
      disabled: selectedPly === 0,
      run: () => select(selectedPly - 1),
    },
    {
      label: "Next move",
      icon: "next",
      disabled: selectedPly === lastPly,
      run: () => select(selectedPly + 1),
    },
    {
      label: "Last position",
      icon: "last",
      disabled: selectedPly === lastPly,
      run: () => select(lastPly),
    },
    { label: "Flip board", icon: "flip", disabled: false, run: flip },
  ] as const;
  return (
    <nav aria-label="Replay controls">
      {actions.map((action) => (
        <button
          key={action.icon}
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          onClick={action.run}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={paths[action.icon]} />
          </svg>
        </button>
      ))}
    </nav>
  );
}
