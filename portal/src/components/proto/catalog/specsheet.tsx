/**
 * PROTOTYPE (production candidate) — Catalog direction "Spec sheet".
 *
 * A reading register with no cards and no table: each domain is a typographic
 * BLOCK — heading, one-line blurb, owner line — followed by a flowing
 * two-column list of service links (status dot · name · region note). The
 * page reads like a product index in good documentation; the grid canvas
 * breathes between blocks. Domain blocks carry the `#domain-…` anchors.
 *
 * References: Stripe docs "Browse by product" rail, printed parts-index
 * sheets.
 */
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

import { ENTRY_DOT, type CatalogEntry, type DomainShelf } from "./data";

export function CatalogSpecsheet({
  shelves,
  query,
  total,
}: {
  shelves: ReadonlyArray<DomainShelf>;
  query: string;
  total: number;
}) {
  const visible = shelves.reduce((sum, shelf) => sum + shelf.items.length, 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="w-fit bg-background text-[13px] tabular-nums text-muted-foreground">
        {query ? `${visible} of ${total} services match` : `${total} services · ${shelves.length} domains`}
      </p>

      {shelves.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">
          No services match. Try a domain like “Storage” or part of a service name.
        </p>
      ) : (
        <div className="flex flex-col">
          {shelves.map((shelf, i) => (
            <DomainBlock key={shelf.domain} shelf={shelf} first={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function DomainBlock({ shelf, first }: { shelf: DomainShelf; first: boolean }) {
  return (
    <section
      id={shelf.anchor}
      className={cn(
        "grid scroll-mt-20 gap-x-12 gap-y-4 py-7 lg:grid-cols-[240px_minmax(0,1fr)]",
        !first && "border-t border-border",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="w-fit bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
          {shelf.domain}
        </h2>
        <p className="w-fit bg-background text-[12.5px] leading-[1.5] text-muted-foreground">
          {shelf.blurb}
        </p>
        <p className="w-fit bg-background font-mono text-[10.5px] text-muted-foreground">
          {shelf.items.length} services · {shelf.items[0]?.owner ?? ""}
        </p>
      </div>
      <ul className="grid content-start gap-x-10 gap-y-0.5 sm:grid-cols-2">
        {shelf.items.map((entry) => (
          <ServiceLine key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function ServiceLine({ entry }: { entry: CatalogEntry }) {
  const note =
    entry.status === "ga"
      ? `${entry.liveRegions} live${entry.plannedRegions ? ` · ${entry.plannedRegions} planned` : ""}`
      : entry.status === "planned"
        ? "planned"
        : "not offered";
  return (
    <li>
      <Link
        to="/proto/capability"
        className={cn(
          "group flex items-baseline gap-2.5 py-1.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 self-center rounded-full", ENTRY_DOT[entry.status])}
        />
        <span className="min-w-0 truncate bg-background text-[13.5px] font-medium text-foreground underline decoration-border underline-offset-[3px] group-hover:text-brand-ink group-hover:decoration-current">
          {entry.name}
        </span>
        <span className="ml-auto shrink-0 bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {note}
        </span>
      </Link>
    </li>
  );
}
