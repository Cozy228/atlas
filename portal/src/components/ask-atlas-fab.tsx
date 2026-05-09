import { useEffect, useId, useState } from "react";
import { IconMessage2, IconX } from "@tabler/icons-react";

import {
  AskAtlasDeferredBody,
  AskAtlasDeferredHeading,
} from "@/components/ask-atlas-deferred-content";
import { cn } from "@/lib/utils";

export function AskAtlasFab() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg transition-colors",
          "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <IconMessage2 className="size-6" aria-hidden />
        <span className="sr-only">Open Ask Atlas (deferred)</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close Ask Atlas dialog"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(640px,calc(100vh-3rem))] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div id={titleId}>
                <AskAtlasDeferredHeading />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <IconX className="size-5" />
              </button>
            </div>
            <AskAtlasDeferredBody />
          </div>
        </div>
      ) : null}
    </>
  );
}
