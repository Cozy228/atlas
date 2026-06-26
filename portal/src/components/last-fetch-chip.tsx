import { useEffect, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

function formatAgo(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Freshness chip for live fetch/resolve pages — shows how long ago the page's
 * data was fetched (from React Query's `dataUpdatedAt`). Renders client-only so
 * the relative time never causes an SSR/hydration mismatch, and re-ticks every
 * 30s so "just now" ages into "1 min ago" without a reload.
 */
export function LastFetchChip({ updatedAt, className }: { updatedAt: number; className?: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => setLabel(formatAgo(Date.now() - updatedAt));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [updatedAt]);

  if (label === null) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground",
        className,
      )}
      title={`Fetched ${new Date(updatedAt).toLocaleString()}`}
    >
      <IconRefresh aria-hidden className="size-3" />
      Last fetch {label}
    </span>
  );
}
