/**
 * Sources registry — two-level register.
 *
 * A two-level grouping of the registered sources: primary axis (Type · Category)
 * as the big section, a secondary axis as the sub-section, the sources beneath.
 * A free-text search narrows the list; a restricted-visibility facet appears only
 * when a restricted source is present. Rows show the clean subject name only — the
 * grouping headers already carry the type and category, so no per-row tags repeat
 * them.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconLock, IconSearch, IconX } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { cn } from "@/lib/utils";

import { CLASS_LABEL, Header } from "./shared";

/** Primary grouping axis. The other dimension becomes the sub-section. */
type Axis = "type" | "category";

const AXES: ReadonlyArray<{ id: Axis; label: string }> = [
  { id: "type", label: "Type" },
  { id: "category", label: "Category" },
];

const CLASS_ORDER: ReadonlyArray<Source["source_class"]> = [
  "terraform-module",
  "confluence-page",
  "policy-document",
  "availability-matrix",
];

const UNCATEGORIZED = "Other";

function classKey(source: Source): string {
  return CLASS_LABEL[source.source_class] ?? source.source_class;
}

function categoryKey(source: Source): string {
  return source.category ?? UNCATEGORIZED;
}

/** The clean subject a source documents — the module's service or the policy
 *  name — with the redundant "… Terraform Module" suffix stripped. */
function subjectName(source: Source): string {
  if (source.source_class === "terraform-module") {
    return source.title.replace(/\s+Terraform Module$/i, "");
  }
  return source.title;
}

export function SourcesByClass({ sources }: { sources: ReadonlyArray<Source> }) {
  const [query, setQuery] = useState("");
  const [axis, setAxis] = useState<Axis>("type");
  const [classFilter, setClassFilter] = useState<ReadonlySet<Source["source_class"]>>(new Set());
  const [restrictedOnly, setRestrictedOnly] = useState(false);

  const q = query.trim().toLowerCase();
  const searchFiltered = useMemo(
    () => (q ? sources.filter((s) => s.title.toLowerCase().includes(q)) : sources),
    [sources, q],
  );

  const filtered = useMemo(
    () =>
      searchFiltered.filter((s) => {
        if (classFilter.size && !classFilter.has(s.source_class)) return false;
        if (restrictedOnly && s.visibility !== "restricted") return false;
        return true;
      }),
    [searchFiltered, classFilter, restrictedOnly],
  );

  const groups = useMemo(() => groupTwoLevel(filtered, axis), [filtered, axis]);

  // Facet counts reflect the search-filtered set so chips never all collapse.
  // Class is the one source dimension with real spread, so it makes the useful filter.
  const classCounts = useMemo(
    () =>
      CLASS_ORDER.map((cls) => ({
        cls,
        count: searchFiltered.filter((s) => s.source_class === cls).length,
      })).filter((e) => e.count > 0),
    [searchFiltered],
  );
  const restrictedCount = useMemo(
    () => searchFiltered.filter((s) => s.visibility === "restricted").length,
    [searchFiltered],
  );

  const anyFilter = q !== "" || classFilter.size > 0 || restrictedOnly;
  const clearAll = () => {
    setQuery("");
    setClassFilter(new Set());
    setRestrictedOnly(false);
  };

  return (
    <div className="flex flex-col gap-7">
      <Header sources={sources} />

      {/* Toolbar: search · primary-axis switch · (when present) restricted facet */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <label className="flex w-full max-w-[340px] items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <IconSearch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sources…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Group by
            </span>
            <div className="flex gap-1">
              {AXES.map((a) => (
                <Segment key={a.id} active={axis === a.id} onClick={() => setAxis(a.id)}>
                  {a.label}
                </Segment>
              ))}
            </div>
          </div>
        </div>

        {/* Facet filters — by source type + (when present) restricted visibility */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="w-[68px] shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Type
          </span>
          {classCounts.map(({ cls, count }) => (
            <Chip
              key={cls}
              active={classFilter.has(cls)}
              onClick={() => setClassFilter(toggle(classFilter, cls))}
              count={count}
            >
              {CLASS_LABEL[cls]}
            </Chip>
          ))}
          {restrictedCount > 0 ? (
            <Chip
              active={restrictedOnly}
              onClick={() => setRestrictedOnly((v) => !v)}
              count={restrictedCount}
            >
              <IconLock aria-hidden className="size-3" />
              Restricted
            </Chip>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-2.5">
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {filtered.length} of {sources.length} sources · {groups.length}{" "}
            {axis === "type" ? "types" : "categories"}
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
              <h2 className="text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                {group.label}
              </h2>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {group.count}
              </span>
            </div>
            <div className="flex flex-col gap-5">
              {group.subs.map((sub) => (
                <div key={sub.key} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
                    <h3 className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
                      {sub.label}
                    </h3>
                    <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                      {sub.items.length}
                    </span>
                  </div>
                  <ul className="grid gap-x-6 gap-y-px sm:grid-cols-2">
                    {sub.items.map((source) => (
                      <li key={source.id}>
                        <SourceRow source={source} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

type SubBlock = { key: string; label: string; items: ReadonlyArray<Source> };
type Group = { key: string; label: string; count: number; subs: ReadonlyArray<SubBlock> };

type LevelSpec = {
  keyOf: (s: Source) => string;
  order: (present: ReadonlyArray<string>) => ReadonlyArray<string>;
};

const CLASS_LABEL_ORDER = CLASS_ORDER.map((c) => CLASS_LABEL[c]);

const typeSpec: LevelSpec = {
  keyOf: classKey,
  order: (present) =>
    [...present].sort((a, b) => {
      const ia = CLASS_LABEL_ORDER.indexOf(a);
      const ib = CLASS_LABEL_ORDER.indexOf(b);
      return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || a.localeCompare(b);
    }),
};

const categorySpec: LevelSpec = {
  keyOf: categoryKey,
  order: (present) =>
    [...present].sort((a, b) =>
      a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b),
    ),
};

/** Group sources two levels deep: by `axis`, then by the other dimension. */
function groupTwoLevel(sources: ReadonlyArray<Source>, axis: Axis): ReadonlyArray<Group> {
  const primary = axis === "type" ? typeSpec : categorySpec;
  const secondary = axis === "type" ? categorySpec : typeSpec;

  const byPrimary = bucket(sources, primary.keyOf);
  return primary.order([...byPrimary.keys()]).map((key) => {
    const items = byPrimary.get(key)!;
    const bySub = bucket(items, secondary.keyOf);
    const subs = secondary.order([...bySub.keys()]).map((sk) => ({
      key: sk,
      label: sk,
      items: bySub.get(sk)!.toSorted((a, b) => subjectName(a).localeCompare(subjectName(b))),
    }));
    return { key, label: key, count: items.length, subs };
  });
}

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

function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-brand-ink/30 bg-brand-tint/60 font-semibold text-brand-ink"
          : "border-border bg-card text-foreground hover:border-border-strong hover:bg-muted",
      )}
    >
      {children}
      <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function toggle<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** A source row: the clean subject name + a restricted lock when applicable. */
function SourceRow({ source }: { source: Source }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group flex items-center justify-between gap-2 rounded-[4px] px-3 py-2",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
          {subjectName(source)}
        </span>
        {source.visibility === "restricted" ? (
          <IconLock aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
      </span>
      <IconArrowRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
      />
    </Link>
  );
}
