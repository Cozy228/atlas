import { IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type CatalogSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function CatalogSearchField({
  value,
  onChange,
  placeholder,
  className,
}: CatalogSearchFieldProps) {
  return (
    <label
      className={cn(
        "flex h-11 w-full max-w-150 items-center gap-2.5 rounded-lg border border-input bg-card px-3.5",
        "shadow-xs transition-[border-color,box-shadow]",
        "hover:border-border-strong",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        className,
      )}
    >
      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
