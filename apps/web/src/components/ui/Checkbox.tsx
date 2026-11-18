import * as Checkbox from "@radix-ui/react-checkbox";

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="ui-check-field">
      <Checkbox.Root
        className="ui-checkbox"
        aria-label={label}
        checked={checked}
        onCheckedChange={(state) => onChange(state === true)}
      >
        <Checkbox.Indicator>
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="none"
            aria-hidden="true"
          >
            <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label}
    </label>
  );
}
