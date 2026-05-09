import { useEffect, useRef } from "react";
import { IconSearch } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type IntentSearchProps = {
  placeholder?: string;
  className?: string;
};

export function IntentSearch({
  placeholder = "What are you looking for?",
  className,
}: IntentSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      className={cn(
        "flex h-[52px] w-full max-w-[520px] items-center gap-2.5 rounded-xl border border-[1.5px] border-border bg-card px-[18px]",
        "shadow-sm transition-[border-color,box-shadow]",
        "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
        className,
      )}
    >
      <IconSearch className="size-[18px] shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        aria-label="Search Atlas catalog"
        className={cn(
          "h-full flex-1 bg-transparent text-[15px] text-foreground outline-none",
          "placeholder:text-muted-foreground",
        )}
      />
      <kbd
        aria-hidden
        className={cn(
          "shrink-0 rounded-[5px] border border-border bg-background px-[7px] py-0.5",
          "font-mono text-[11px] font-medium text-muted-foreground",
        )}
      >
        ⌘K
      </kbd>
    </label>
  );
}
