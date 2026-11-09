import { useState } from "react";
import type { Filters } from "../../api/discovery";
import { TimeControl } from "./TimeControl";

export function LibraryFilters({
  filters,
  apply,
}: {
  filters: Filters;
  apply: (value: Filters) => void;
}) {
  return (
    <div className="library-filters">
      <div
        className="time-filters"
        role="group"
        aria-label="Filter by time control"
      >
        {["", "rapid", "blitz", "bullet", "daily"].map((value) => (
          <button
            key={value}
            aria-pressed={filters.time_class === value}
            onClick={() => apply({ ...filters, time_class: value })}
          >
            {value ? <TimeControl value={value} /> : "All games"}
          </button>
        ))}
      </div>
      <details className="advanced-filters">
        <summary>More filters</summary>
        <AdvancedFilters
          key={`${filters.color}:${filters.opponent}:${filters.time_class}`}
          filters={filters}
          apply={apply}
        />
      </details>
    </div>
  );
}

function AdvancedFilters({
  filters,
  apply,
}: {
  filters: Filters;
  apply: (value: Filters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  return (
    <form
      className="filters"
      onSubmit={(event) => {
        event.preventDefault();
        apply(draft);
      }}
    >
      <label>
        Player color
        <select
          value={draft.color}
          onChange={(event) => {
            const color = event.target.value;
            if (color === "" || color === "white" || color === "black")
              setDraft({ ...draft, color });
          }}
        >
          <option value="">Either</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </label>
      <label>
        Opponent
        <input
          maxLength={25}
          value={draft.opponent}
          onChange={(event) =>
            setDraft({ ...draft, opponent: event.target.value })
          }
        />
      </label>
      <label>
        Time class
        <select
          value={draft.time_class}
          onChange={(event) =>
            setDraft({ ...draft, time_class: event.target.value })
          }
        >
          <option value="">All</option>
          {["bullet", "blitz", "rapid", "daily"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <button>Apply filters</button>
    </form>
  );
}
