import * as Select from "@radix-ui/react-select";
import { useId } from "react";

type Option = { value: string; label: string };

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="select-field">
      <span id={id}>{label}</span>
      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger aria-labelledby={id} className="ui-select">
          <Select.Value placeholder="Choose a branch" />
          <Select.Icon asChild>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="ui-select-menu"
            position="popper"
            sideOffset={4}
          >
            <Select.Viewport>
              {options.map((item) => (
                <Select.Item
                  key={item.value}
                  value={item.value}
                  className="ui-select-option"
                >
                  <Select.ItemText>{item.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
