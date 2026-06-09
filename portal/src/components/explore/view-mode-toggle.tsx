import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ViewModeOption<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
};

/**
 * Shared segmented control for switching result layouts (cards / table / matrix).
 * Catalog and Availability render the same control so the two pages stay in sync:
 * outlined container, brand-tinted active segment.
 */
export function ViewModeToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<ViewModeOption<T>>;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex w-fit overflow-hidden rounded-md border border-border"
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Fragment key={option.value}>
            {index > 0 ? <span className="w-px self-stretch bg-border" aria-hidden /> : null}
            <button
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active
                  ? "bg-brand-tint text-primary"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
