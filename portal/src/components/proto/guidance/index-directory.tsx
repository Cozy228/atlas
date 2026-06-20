/**
 * PROTOTYPE (production candidate) — Guidance index direction "Directory".
 *
 * IA model: MASTER–DETAIL by category. A persistent category rail on the left,
 * the selected category's guidances on the right. The whole taxonomy stays in
 * view while you read one category — good when you know the area you want and
 * want to stay oriented. Whatever you have running is surfaced as the next stop.
 */
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { categoryGroups, type CategoryGroup } from "./catalog";
import { RouteLine } from "./parts";
import { NextStops, categoryIcon, useResume } from "./wayfinding";

export function GuidanceDirectory() {
  const groups = useMemo(() => categoryGroups(), []);
  const { resumable, nextIndex, hydrated } = useResume(groups);

  const [selected, setSelected] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !hydrated || nextIndex < 0) return;
    setSelected(nextIndex);
  }, [touched, hydrated, nextIndex]);

  const inProgress = useMemo(() => new Set(resumable.map((r) => r.categoryIndex)), [resumable]);
  const active = groups[selected];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Guidance</h1>
        <p className="max-w-[58ch] text-[13.5px] leading-[1.55] text-muted-foreground">
          Browse the catalog by category. The rail keeps every category in view; open one to read its
          guidances.
        </p>
      </header>

      <NextStops resumable={resumable} groups={groups} />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:items-start md:gap-8">
        <nav aria-label="Categories" className="md:sticky md:top-6">
          <ol className="flex flex-col gap-0.5">
            {groups.map((group, i) => {
              const Mark = categoryIcon(group.category.id);
              const isSel = i === selected;
              return (
                <li key={group.category.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setTouched(true);
                      setSelected(i);
                    }}
                    aria-current={isSel ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-[6px] py-2.5 pl-3 pr-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      isSel ? "bg-brand-tint" : "hover:bg-surface-2",
                    )}
                  >
                    {isSel ? (
                      <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-[6px] transition-colors",
                        isSel ? "bg-brand text-primary-foreground" : "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      <Mark className="size-[1.05rem]" stroke={1.7} />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-0.01em]",
                        isSel ? "text-brand-ink" : "text-foreground",
                      )}
                    >
                      {group.category.label}
                    </span>
                    {inProgress.has(i) ? (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" title="In progress" />
                    ) : null}
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {group.items.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {active ? <CategoryPage key={active.category.id} group={active} /> : null}
      </div>
    </div>
  );
}

function CategoryPage({ group }: { group: CategoryGroup }) {
  const openCount = group.items.filter((g) => g.status === "published").length;

  return (
    <section className="flex animate-in flex-col gap-4 fade-in slide-in-from-right-2 duration-300 motion-reduce:animate-none">
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <h2 className="text-[20px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {group.category.label}
        </h2>
        <p className="max-w-[64ch] text-[13px] leading-[1.5] text-muted-foreground">
          {group.category.blurb}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {group.items.length} {group.items.length === 1 ? "guidance" : "guidances"}
          <span className="text-success"> · {openCount} open</span>
        </p>
      </div>
      <ul className="flex flex-col">
        {group.items.map((guidance) => (
          <li key={guidance.id}>
            <RouteLine guidance={guidance} withDestination />
          </li>
        ))}
      </ul>
    </section>
  );
}
