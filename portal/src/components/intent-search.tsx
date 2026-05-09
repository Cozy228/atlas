import { lazy, useEffect, useState } from "react";
import { IconSearch } from "@tabler/icons-react";

import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";

type IntentSearchProps = {
  placeholder?: string;
  className?: string;
};

const IntentSearchPalette = lazy(() => import("./intent-search-palette"));

export function IntentSearch({
  placeholder = "What are you looking for?",
  className,
}: IntentSearchProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Search Atlas catalog"
        className={cn(
          "flex h-[52px] w-full max-w-[520px] items-center gap-2.5 rounded-xl border border-[1.5px] border-border bg-card px-[18px] text-left",
          "shadow-sm transition-[border-color,box-shadow]",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
          className,
        )}
      >
        <IconSearch className="size-[18px] shrink-0 text-muted-foreground" />
        <span className="flex-1 text-[15px] text-muted-foreground">
          {placeholder}
        </span>
        <kbd
          aria-hidden
          className={cn(
            "shrink-0 rounded-[5px] border border-border bg-background px-[7px] py-0.5",
            "font-mono text-[11px] font-medium text-muted-foreground",
          )}
        >
          ⌘K
        </kbd>
      </button>
      <ClientOnly>
        {open ? <IntentSearchPalette open={open} onOpenChange={setOpen} /> : null}
      </ClientOnly>
    </>
  );
}


