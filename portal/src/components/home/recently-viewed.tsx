import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ClientOnly } from "@/components/client-only";
import { cn } from "@/lib/utils";

export type RecentItem =
  // service is addressed by its canonical resource slug `{provider}/{id}`
  // (plan 020 15d), no longer a topic id. (Landing zones left the catalog in
  // plan 019, so there is no landing-zone recent item.)
  | { kind: "service"; slug: string; name: string }
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
  idValue: string | undefined,
  name: string | undefined,
): RecentItem | null {
  if (!kind || !idValue || !name) return null;
  if (kind === "source") return { kind, sourceId: idValue, name };
  return { kind, slug: idValue, name };
}

export function useRecordRecent(item: RecentItem | null) {
  const kind = item?.kind;
  const idValue = item ? recentIdValue(item) : undefined;
  const name = item?.name;

  useEffect(() => {
    const next = recentItemFromParts(kind, idValue, name);
    if (!next) return;
    pushRecent(next);
  }, [kind, idValue, name]);
}

function recentIdValue(item: RecentItem): string {
  return item.kind === "source" ? item.sourceId : item.slug;
}

function recentKey(item: RecentItem): string {
  return `${item.kind}:${recentIdValue(item)}`;
}

function isRecentItem(value: unknown): value is RecentItem {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.kind !== "string") return false;
  if (typeof candidate.name !== "string") return false;
  if (candidate.kind === "source") return typeof candidate.sourceId === "string";
  return candidate.kind === "service" && typeof candidate.slug === "string";
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

  // Stay on a single line: show a few of the most recent and never wrap.
  const shown = items.slice(0, 4);

  return (
    <section
      aria-label="Jump back in"
      className="flex max-w-full items-center justify-center gap-x-2 overflow-hidden"
    >
      {lead ? <span className="shrink-0 text-[12.5px] text-muted-foreground">{lead}</span> : null}
      <ul className="flex min-w-0 gap-1.5">
        {shown.map((item) => (
          <li key={recentKey(item)} className="min-w-0">
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
  const type = (
    <span className="font-mono type-caption uppercase tracking-[0.05em] text-muted-foreground">
      {item.kind}
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
  const slashIndex = item.slug.indexOf("/");
  const provider = slashIndex >= 0 ? item.slug.slice(0, slashIndex) : item.slug;
  const id = slashIndex >= 0 ? item.slug.slice(slashIndex + 1) : item.slug;
  return (
    <Link to="/service/$provider/$id" params={{ provider, id }} className={className}>
      <span>{item.name}</span>
      {type}
    </Link>
  );
}
