import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type RecentItem =
  | { kind: "capability"; topicId: string; name: string }
  | { kind: "landing-zone"; topicId: string; name: string }
  | { kind: "source"; sourceId: string; name: string };

const STORAGE_KEY = "atlas:recently-viewed";

export function loadRecent(): ReadonlyArray<RecentItem> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentItem).slice(0, 6);
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  if (typeof window === "undefined") return;
  const current = loadRecent();
  const id = recentKey(item);
  const next = [item, ...current.filter((existing) => recentKey(existing) !== id)].slice(0, 6);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be disabled (private mode); silently no-op.
  }
}

export function recentItemFromParts(
  kind: RecentItem["kind"] | undefined,
  topicOrSourceId: string | undefined,
  name: string | undefined,
): RecentItem | null {
  if (!kind || !topicOrSourceId || !name) return null;
  if (kind === "source") {
    return { kind, sourceId: topicOrSourceId, name };
  }
  return { kind, topicId: topicOrSourceId, name };
}

export function useRecordRecent(item: RecentItem | null) {
  const kind = item?.kind;
  const topicOrSourceId = kind === "source" ? item?.sourceId : item?.topicId;
  const name = item?.name;

  useEffect(() => {
    const next = recentItemFromParts(kind, topicOrSourceId, name);
    if (!next) return;
    pushRecent(next);
  }, [kind, topicOrSourceId, name]);
}

function recentKey(item: RecentItem): string {
  return item.kind === "source" ? `source:${item.sourceId}` : `${item.kind}:${item.topicId}`;
}

function isRecentItem(value: unknown): value is RecentItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.kind !== "string") return false;
  if (typeof candidate.name !== "string") return false;
  if (candidate.kind === "source") return typeof candidate.sourceId === "string";
  return (
    (candidate.kind === "capability" || candidate.kind === "landing-zone") &&
    typeof candidate.topicId === "string"
  );
}

export function RecentlyViewed() {
  return (
    <ClientOnly fallback={<RecentlyViewedSkeleton />}>
      <RecentlyViewedClient />
    </ClientOnly>
  );
}

function RecentlyViewedSkeleton() {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-hidden>
      {Array.from({ length: 4 }).map((_, idx) => (
        <li key={idx}>
          <Skeleton className="h-7 w-32 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function RecentlyViewedClient() {
  const [items] = useState<ReadonlyArray<RecentItem>>(() => loadRecent());

  if (items.length === 0) {
    return (
      <p className="type-detail leading-5 text-muted-foreground">
        Open a capability or landing zone to populate this list.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={recentKey(item)}>
          <RecentChip item={item} />
        </li>
      ))}
    </ul>
  );
}

function RecentChip({ item }: { item: RecentItem }) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-[5px] text-xs font-medium text-foreground transition-colors",
    "hover:border-border-strong hover:bg-muted",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  );
  const typeLabel = item.kind === "landing-zone" ? "landing zone" : item.kind;
  const type = (
    <span className="font-mono type-caption uppercase tracking-[0.05em] text-muted-foreground">
      {typeLabel}
    </span>
  );

  if (item.kind === "source") {
    return (
      <Link to="/sources/$sourceId" params={{ sourceId: item.sourceId }} className={className}>
        <span>{item.name}</span>
        {type}
      </Link>
    );
  }
  return (
    <Link to="/catalog/$topicId" params={{ topicId: item.topicId }} className={className}>
      <span>{item.name}</span>
      {type}
    </Link>
  );
}
