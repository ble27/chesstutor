import { SelectField } from "../../components/ui/Select";
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
      <SelectField
        label="Archive month"
        value={month}
        onChange={(value) => apply(value, draft)}
        options={months.map((value) => ({ value, label: value }))}
      />
      <SelectField
        label="Time control"
        value={draft.time_class || "all"}
        onChange={(value) =>
          setDraft({ ...draft, time_class: value === "all" ? "" : value })
        }
        options={["All", "Rapid", "Blitz", "Bullet", "Daily"].map((label) => ({
          label,
          value: label.toLowerCase(),
        }))}
      />
      <SelectField
        label="Player color"
        value={draft.color || "either"}
        onChange={(value) =>
          setDraft({
            ...draft,
            color: value === "white" || value === "black" ? value : "",
          })
        }
        options={["Either", "White", "Black"].map((label) => ({
          label,
          value: label.toLowerCase(),
        }))}
      />
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
