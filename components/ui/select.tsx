"use client";

import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Selecciona",
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);

  return (
    <Dropdown
      className={cn("w-full", className)}
      panelClassName="w-full min-w-full"
      trigger={
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            disabled ? "cursor-not-allowed opacity-50" : "hover:border-ring/60",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: selected.color }}
              />
            )}
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      {(close) => (
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                close();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                option.value === value && "bg-primary/10 text-primary",
              )}
            >
              {option.color && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              )}
              <span className="flex-1 truncate">{option.label}</span>
              {option.value === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
