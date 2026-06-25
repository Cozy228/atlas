/**
 * Sources direction "By class", scaled.
 *
 * The original by-class view grouped on a single fixed axis (source class).
 * At a handful of sources that read fine; at dozens, each class block becomes a
 * wall of rows with no way to narrow it. This version keeps the grouped
 * register but makes the grouping a *tool*: a free-text search, a switchable
 * grouping axis (Class / Steward / Authority / Freshness), and facet filters
 * (authority level · freshness · restricted) that narrow live. Grouping buys
 * one level of structure; search + facets carry the rest.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconLock, IconSearch, IconX } from "@tabler/icons-react";
import type { AuthorityLevel, Source } from "@atlas/schema";

import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { AUTHORITY_ORDER, type FreshnessState } from "@/lib/evidence";
import { cn } from "@/lib/utils";

import { CATEGORY_ORDER, sourceCategory } from "./scale";
import { AUTHORITY_BAR, CLASS_LABEL, FRESHNESS_META, Header, freshnessMap } from "./shared";

/**
 * "class" is the default and renders a two-level register (class → category);
 * the others are flat single-axis groupings.
 */
type Axis = "class" | "steward" | "authority" | "freshness";

const AXES: ReadonlyArray<{ id: Axis; label: string }> = [
  { id: "class", label: "Class" },
  { id: "steward", label: "Steward" },
  { id: "authority", label: "Authority" },
  { id: "freshness", label: "Freshness" },
];

const CLASS_ORDER = ["terraform-module", "confluence-page", "policy-document"] as const;
const FRESHNESS_ORDER: ReadonlyArray<FreshnessState> = ["current", "needs-review", "stale"];

export function SourcesByClass({ sources }: { sources: ReadonlyArray<Source> }) {
  const [query, setQuery] = useState("");
  const [axis, setAxis] = useState<Axis>("class");
  const [authorityFilter, setAuthorityFilter] = useState<ReadonlySet<AuthorityLevel>>(new Set());
  const [freshnessFilter, setFreshnessFilter] = useState<ReadonlySet<FreshnessState>>(new Set());
  const [restrictedOnly, setRestrictedOnly] = useState(false);

  const freshOf = useMemo(() => freshnessMap(sources), [sources]);

  const q = query.trim().toLowerCase();
  const searchFiltered = useMemo(
    () =>
      q
        ? sources.filter((s) => `${s.title} ${s.id} ${s.steward}`.toLowerCase().includes(q))
        : sources,
    [sources, q],
  );

  const filtered = useMemo(
    () =>
      searchFiltered.filter((s) => {
        if (authorityFilter.size && !authorityFilter.has(s.authority_level)) return false;
        if (freshnessFilter.size && !freshnessFilter.has(freshOf.get(s.id) ?? "needs-review"))
          return false;
        if (restrictedOnly && s.visibility !== "restricted") return false;
        return true;
      }),
    [searchFiltered, authorityFilter, freshnessFilter, restrictedOnly, freshOf],
  );

  const groups = useMemo(() => groupTwoLevel(filtered, axis, freshOf), [filtered, axis, freshOf]);

  // Facet counts reflect the search-filtered set so chips never all collapse.
  const authorityCounts = useMemo(
    () =>
      AUTHORITY_ORDER.map((level) => ({
        level,
        count: searchFiltered.filter((s) => s.authority_level === level).length,
      })).filter((e) => e.count > 0),
    [searchFiltered],
  );
  const freshnessCounts = useMemo(
    () =>
      FRESHNESS_ORDER.map((state) => ({
        state,
        count: searchFiltered.filter((s) => (freshOf.get(s.id) ?? "needs-review") === state).length,
      })).filter((e) => e.count > 0),
    [searchFiltered, freshOf],
  );
  const restrictedCount = useMemo(
    () => searchFiltered.filter((s) => s.visibility === "restricted").length,
    [searchFiltered],
  );

  const anyFilter =
    q !== "" || authorityFilter.size > 0 || freshnessFilter.size > 0 || restrictedOnly;
  const clearAll = () => {
    setQuery("");
    setAuthorityFilter(new Set());
    setFreshnessFilter(new Set());
    setRestrictedOnly(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <Header sources={sources} />

      {/* Toolbar: search + grouping axis */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-2 focus-within:border-border-strong">
            <IconSearch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, id, or steward…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Group by
            </span>
            <div className="flex flex-wrap gap-1">
              {AXES.map((a) => (
                <Segment key={a.id} active={axis === a.id} onClick={() => setAxis(a.id)}>
                  {a.label}
                </Segment>
              ))}
            </div>
          </div>
        </div>

        {/* Facet filters — one labelled row per facet so chips align */}
        <div className="flex flex-col gap-1.5">
          <FacetRow label="Authority">
            {authorityCounts.map(({ level, count }) => (
              <Chip
                key={level}
                active={authorityFilter.has(level)}
                onClick={() => setAuthorityFilter(toggle(authorityFilter, level))}
                dot={AUTHORITY_BAR[level]}
                count={count}
              >
                <span className="capitalize">{level}</span>
              </Chip>
            ))}
          </FacetRow>
          <FacetRow label="Freshness">
            {freshnessCounts.map(({ state, count }) => (
              <Chip
                key={state}
                active={freshnessFilter.has(state)}
                onClick={() => setFreshnessFilter(toggle(freshnessFilter, state))}
                dot={FRESHNESS_META[state].dot}
                count={count}
              >
                {FRESHNESS_META[state].label}
              </Chip>
            ))}
          </FacetRow>
          {restrictedCount > 0 ? (
            <FacetRow label="Visibility">
              <Chip
                active={restrictedOnly}
                onClick={() => setRestrictedOnly((v) => !v)}
                count={restrictedCount}
              >
                <IconLock aria-hidden className="size-3" />
                Restricted
              </Chip>
            </FacetRow>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-2.5">
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} of {sources.length} sources · {groups.length} {axisNoun(axis)}
          </p>
          {anyFilter ? (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              <IconX aria-hidden className="size-3" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
          No sources match. Clear a filter or widen your search.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-2.5 border-b-2 border-border-strong pb-2">
              {group.dot ? (
                <span
                  aria-hidden
                  className={cn("size-2 shrink-0 self-center rounded-full", group.dot)}
                />
              ) : null}
              <h2
                className={cn(
                  "bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground",
                  axis === "authority" && "capitalize",
                  axis === "steward" && "font-mono text-[15px]",
                )}
              >
                {group.label}
              </h2>
              <span className="ml-auto bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                {group.count}
              </span>
            </div>
            <div className="flex flex-col gap-5">
              {group.subs.map((sub) => (
                <SubGroup key={sub.key} label={sub.label} items={sub.items} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** A category sub-block within a class (the second level of the nested view). */
function SubGroup({ label, items }: { label: string; items: ReadonlyArray<Source> }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
        <h3 className="bg-background text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
          {label}
        </h3>
        <span className="ml-auto bg-background font-mono text-[10px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="grid gap-x-6 gap-y-px sm:grid-cols-2">
        {items.map((source) => (
          <li key={source.id}>
            <ClassRow source={source} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Grouping
 * -------------------------------------------------------------------------- */

type SubBlock = { key: string; label: string; items: ReadonlyArray<Source> };
type Group = {
  key: string;
  label: string;
  dot?: string;
  count: number;
  subs: ReadonlyArray<SubBlock>;
};

/** A grouping dimension — how to key a source, order the keys, and label them. */
type LevelKind = "class" | "category" | "steward" | "authority" | "freshness";

type LevelSpec = {
  keyOf: (s: Source) => string;
  /** Order the present keys (a key set) into display order. */
  order: (present: ReadonlyArray<string>) => ReadonlyArray<string>;
  label: (key: string) => string;
  dot?: (key: string) => string | undefined;
};

function levelSpec(kind: LevelKind, freshOf: ReadonlyMap<string, FreshnessState>): LevelSpec {
  switch (kind) {
    case "class":
      return {
        keyOf: (s) => s.source_class,
        order: (p) => CLASS_ORDER.filter((k) => p.includes(k)),
        label: (k) => CLASS_LABEL[k as Source["source_class"]],
      };
    case "category":
      return {
        keyOf: (s) => sourceCategory(s),
        order: (p) => CATEGORY_ORDER.filter((k) => p.includes(k)),
        label: (k) => k,
      };
    case "steward":
      return {
        keyOf: (s) => s.steward,
        order: (p) => [...p].sort((a, b) => a.localeCompare(b)),
        label: (k) => k,
      };
    case "authority":
      return {
        keyOf: (s) => s.authority_level,
        order: (p) => AUTHORITY_ORDER.filter((k) => p.includes(k)),
        label: (k) => k,
        dot: (k) => AUTHORITY_BAR[k],
      };
    case "freshness":
      return {
        keyOf: (s) => freshOf.get(s.id) ?? "needs-review",
        order: (p) => FRESHNESS_ORDER.filter((k) => p.includes(k)),
        label: (k) => FRESHNESS_META[k as FreshnessState].label,
        dot: (k) => FRESHNESS_META[k as FreshnessState].dot,
      };
  }
}

/**
 * Second level per primary axis. The chosen axis is level 1; a sensible
 * structural sub-axis breaks each block so no single group is a wall of rows.
 * Stewards are class-bound in the fixture, so they nest by category (class
 * would be a single sub-block); the cross-cutting axes nest by class.
 */
const SECONDARY: Record<Axis, LevelKind> = {
  class: "category",
  steward: "category",
  authority: "class",
  freshness: "class",
};

function bucket(
  sources: ReadonlyArray<Source>,
  keyOf: (s: Source) => string,
): Map<string, Source[]> {
  const map = new Map<string, Source[]>();
  for (const s of sources) {
    const k = keyOf(s);
    (map.get(k) ?? map.set(k, []).get(k)!).push(s);
  }
  return map;
}

/** Group sources two levels deep: by `axis`, then by its secondary sub-axis. */
function groupTwoLevel(
  sources: ReadonlyArray<Source>,
  axis: Axis,
  freshOf: ReadonlyMap<string, FreshnessState>,
): ReadonlyArray<Group> {
  const primary = levelSpec(axis, freshOf);
  const secondary = levelSpec(SECONDARY[axis], freshOf);

  const byPrimary = bucket(sources, primary.keyOf);
  return primary.order([...byPrimary.keys()]).map((key) => {
    const items = byPrimary.get(key)!;
    const bySub = bucket(items, secondary.keyOf);
    const subs = secondary.order([...bySub.keys()]).map((sk) => ({
      key: sk,
      label: secondary.label(sk),
      items: bySub.get(sk)!.toSorted((a, b) => a.title.localeCompare(b.title)),
    }));
    return { key, label: primary.label(key), dot: primary.dot?.(key), count: items.length, subs };
  });
}

function axisNoun(axis: Axis): string {
  return axis === "class"
    ? "classes"
    : axis === "steward"
      ? "stewards"
      : axis === "authority"
        ? "authority levels"
        : "freshness bands";
}

function toggle<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/* -------------------------------------------------------------------------- *
 * Controls
 * -------------------------------------------------------------------------- */

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-[4px] px-2.5 py-1 text-[12.5px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-brand-tint/60 font-semibold text-brand-ink"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FacetRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-[68px] shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  dot,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  dot?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-brand-ink/30 bg-brand-tint/60 font-semibold text-brand-ink"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
    >
      {dot ? <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} /> : null}
      {children}
      <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function ClassRow({ source }: { source: Source }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group flex h-full flex-col gap-1.5 rounded-[4px] px-3 py-2.5",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
            {source.title}
          </span>
          {source.visibility === "restricted" ? (
            <IconLock aria-hidden className="size-3 text-muted-foreground" />
          ) : null}
        </span>
        <IconArrowRight
          aria-hidden
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
        />
      </span>
      <code className="font-mono text-[10.5px] text-muted-foreground">{source.id}</code>
      <span className="flex flex-wrap items-center gap-2">
        <AuthorityBadge level={source.authority_level} />
        <FreshnessIndicator source={source} />
        <span className="font-mono text-[10.5px] text-muted-foreground">{source.steward}</span>
      </span>
    </Link>
  );
}
