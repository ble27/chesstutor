import type { KeyboardEvent } from "react";

export const reviewTabs = ["Analysis", "Review"] as const;
export type ReviewTab = (typeof reviewTabs)[number];

export function reviewTabId(tab: ReviewTab): string {
  return tab.toLowerCase().replaceAll(" ", "-");
}

export function ReviewTabs({
  selected,
  select,
}: {
  selected: ReviewTab;
  select: (tab: ReviewTab) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = reviewTabs.indexOf(selected);
    const targets: Record<string, number> = {
      ArrowRight: (index + 1) % reviewTabs.length,
      ArrowLeft: (index + reviewTabs.length - 1) % reviewTabs.length,
      Home: 0,
      End: reviewTabs.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const tab = reviewTabs[next];
    if (tab) {
      select(tab);
      const buttons =
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons[next]?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label="Game review views"
      onKeyDown={onKeyDown}
      className="review-tabs"
    >
      {reviewTabs.map((tab) => (
        <button
          key={tab}
          id={`tab-${reviewTabId(tab)}`}
          role="tab"
          aria-selected={selected === tab}
          aria-controls={`view-${reviewTabId(tab)}`}
          tabIndex={selected === tab ? 0 : -1}
          onClick={() => select(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
