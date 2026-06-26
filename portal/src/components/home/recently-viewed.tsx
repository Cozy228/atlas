import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";

export type RecentItem =
  | { kind: "service"; topicId: string; name: string }
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
    (candidate.kind === "service" || candidate.kind === "landing-zone") &&
    typeof candidate.topicId === "string"
  );
}

/**
 * Real recently-viewed, from this browser's click history (localStorage).
 * Renders nothing at all when there is no history — no empty-state copy, no
 * lead. The optional `lead` is shown only alongside actual items.
 */
export function RecentlyViewed({ lead }: { lead?: string }) {
  return (
    <ClientOnly fallback={null}>
      <RecentlyViewedClient lead={lead} />
    </ClientOnly>
  );
}

function RecentlyViewedClient({ lead }: { lead?: string }) {
  const [items] = useState<ReadonlyArray<RecentItem>>(() => loadRecent());

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Jump back in"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5"
    >
      {lead ? (
        <>
          <span className="text-[12.5px] text-muted-foreground">{lead}</span>
          <span aria-hidden className="bg-background text-muted-foreground/40">
            ·
          </span>
        </>
      ) : null}
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={recentKey(item)}>
            <RecentChip item={item} />
          </li>
        ))}
      </ul>
    </section>
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
