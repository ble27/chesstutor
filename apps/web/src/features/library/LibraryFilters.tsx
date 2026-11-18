import { useState } from "react";
import type { Filters } from "../../api/discovery";

type Props = {
  month: string;
  months: readonly string[];
  filters: Filters;
  apply: (month: string, filters: Filters) => void;
};

export function LibraryFilters(props: Props) {
  const { filters, month } = props;
  return <FilterForm key={JSON.stringify([month, filters])} {...props} />;
}

function FilterForm({ month, months, filters, apply }: Props) {
  const [draft, setDraft] = useState(filters);
  return (
    <form
      className="library-filter-bar"
      onSubmit={(event) => {
        event.preventDefault();
        apply(month, draft);
      }}
    >
      <label>
        Archive month
        <select
          value={month}
          onChange={(event) => apply(event.target.value, draft)}
        >
          {months.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Time control
        <select
          value={draft.time_class}
          onChange={(event) =>
            setDraft({ ...draft, time_class: event.target.value })
          }
        >
          <option value="">All</option>
          <option value="rapid">Rapid</option>
          <option value="blitz">Blitz</option>
          <option value="bullet">Bullet</option>
          <option value="daily">Daily</option>
        </select>
      </label>
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
      <button>Apply filters</button>
    </form>
  );
}
