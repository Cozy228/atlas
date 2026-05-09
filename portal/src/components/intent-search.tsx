import { IconSearch } from "@tabler/icons-react";

import { useAskAtlas } from "@/components/ask-atlas/context";
import { cn } from "@/lib/utils";

type IntentSearchProps = {
  placeholder?: string;
  className?: string;
};

export function IntentSearch({
  placeholder = "What are you looking for?",
  className,
}: IntentSearchProps) {
  const { openSearch } = useAskAtlas();

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-haspopup="dialog"
      aria-label="Search Atlas catalog"
      className={cn(
        "flex h-10 w-full max-w-[520px] items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left",
        "shadow-xs transition-[border-color,box-shadow]",
        "hover:border-border-strong",
        "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <IconSearch className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm text-muted-foreground">
        {placeholder}
      </span>
      <kbd
        aria-hidden
        className={cn(
          "shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5",
          "font-mono text-[10px] font-medium text-muted-foreground",
        )}
      >
        ⌘K
      </kbd>
    </button>
  );
}
