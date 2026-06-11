/**
 * PROTOTYPE (production candidate) — Sources direction "By class".
 *
 * A browse-by-kind register: sources grouped by what they physically are —
 * Terraform modules, Confluence pages, Policy documents — each a labelled block
 * of compact rows. For when you know the shape of the evidence you want.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconLock } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { cn } from "@/lib/utils";

import { Header } from "./ledger";
import { CLASS_LABEL } from "./shared";

const CLASS_ORDER: ReadonlyArray<Source["source_class"]> = [
  "terraform-module",
  "confluence-page",
  "policy-document",
];

export function SourcesByClass({ sources }: { sources: ReadonlyArray<Source> }) {
  const groups = CLASS_ORDER.map((cls) => ({
    cls,
    items: sources
      .filter((s) => s.source_class === cls)
      .toSorted((a, b) => a.title.localeCompare(b.title)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <Header sources={sources} />

      {groups.map(({ cls, items }) => (
        <section key={cls} className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2.5 border-b-2 border-border-strong pb-2">
            <h2 className="bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
              {CLASS_LABEL[cls]}
            </h2>
            <span className="ml-auto bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
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
        </section>
      ))}
    </div>
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
