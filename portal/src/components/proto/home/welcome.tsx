/**
 * PROTOTYPE (production candidate) — Home direction "Welcome desk".
 *
 * Evolves the liked round-1 baseline: the centered hero (eyebrow · welcome ·
 * search · popular · stats) and the "From idea to production" JourneyGrid stay.
 * The four sections that previously read as one pill/tile pattern each get
 * their own structural register instead:
 *   - Jump back in   → one hairline LEDGER BAND (shared cells, not pills)
 *   - Browse by intent → DOOR ROWS in a single panel (title column + purpose)
 *   - Service catalog → a typographic BOOK INDEX (columned link lines)
 *   - What changed   → a DATE-LED TIMELINE with recency hierarchy
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { JourneyGrid } from "@/components/home/journey-grid";
import { IntentSearch } from "@/components/intent-search";
import { cn } from "@/lib/utils";

import {
  ANNOUNCE_TONE,
  ANNOUNCEMENTS,
  INTENTS,
  POPULAR,
  RECENTS,
  type HomeLoaderData,
  type ProtoRoute,
} from "./data";

export function HomeWelcome({ data }: { data: HomeLoaderData }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-8">
        <Hero
          serviceCount={data.serviceCount}
          domainCount={data.domainCount}
          regionCount={data.regionCount}
        />
        <ResumeBand />
      </div>
      <IntentDoors />
      <section>
        <SectionHead
          title="From idea to production"
          description="Follow the lifecycle or jump to what you need right now."
        />
        <JourneyGrid linkTargets="proto" />
      </section>
      <CatalogIndex serviceCount={data.serviceCount} domains={data.domains} />
      <WhatChanged />
    </div>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { to: ProtoRoute; label: string };
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="w-fit bg-background text-[1.375rem] font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="w-fit bg-background text-[13.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="flex shrink-0 items-center gap-1 bg-background text-[13px] font-semibold text-brand-ink hover:underline"
        >
          {action.label}
          <IconArrowRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

/* ========================================================================== *
 * Hero — centered welcome + search (kept from round 1)
 * ========================================================================== */

function Hero({
  serviceCount,
  domainCount,
  regionCount,
}: {
  serviceCount: number;
  domainCount: number;
  regionCount: number;
}) {
  return (
    <section className="flex flex-col items-center gap-5 text-center">
      {/* pl matches the tracking: letter-spacing trails the last glyph, so a
          centered box otherwise renders its text visibly left of the axis. */}
      <span className="w-fit bg-background pl-[0.14em] font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Atlas Platform
      </span>
      <h1 className="w-fit max-w-[18ch] bg-background text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-balance text-foreground">
        Welcome to Atlas Portal
      </h1>
      <p className="w-fit max-w-[52ch] bg-background text-[1.0625rem] leading-[1.55] text-pretty text-muted-foreground">
        Find the right guidance, services, and evidence to build with confidence. Every claim links
        back to its source.
      </p>
      <div className="flex w-full max-w-[600px] flex-col items-center gap-3 pt-1">
        <IntentSearch className="h-12 w-full" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="bg-background text-xs font-medium text-muted-foreground">Popular</span>
          {POPULAR.map((q) => (
            <Link
              key={q}
              to="/proto/catalog"
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {q}
            </Link>
          ))}
        </div>
      </div>
      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-2 pt-1">
        <Stat value={serviceCount} label="services" />
        <Stat value={domainCount} label="domains" />
        <Stat value={regionCount} label="regions & outposts" />
      </dl>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 bg-background">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[1.375rem] font-bold tabular-nums tracking-[-0.02em] text-foreground">
        {value}
      </dd>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}

/* ========================================================================== *
 * Jump back in — a quiet personal resume line, not a formal panel. One muted
 * lead, then the recently-touched items as understated links. Reads as "you
 * were here", distinct in register from the Popular query chips in the hero.
 * ========================================================================== */

function ResumeBand() {
  return (
    <section
      aria-label="Jump back in"
      className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1.5"
    >
      <span className="bg-background text-[12.5px] text-muted-foreground">
        Pick up where you left off
      </span>
      <span aria-hidden className="bg-background text-muted-foreground/40">
        ·
      </span>
      {RECENTS.map((recent, i) => (
        <span key={recent.name} className="flex items-baseline gap-2">
          {i > 0 ? (
            <span aria-hidden className="bg-background text-muted-foreground/30">
              /
            </span>
          ) : null}
          <Link
            to={recent.to}
            className="group inline-flex items-baseline gap-1 bg-background text-[12.5px] font-semibold text-foreground underline decoration-border underline-offset-[3px] transition-colors hover:text-brand-ink hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {recent.name}
            <span className="font-mono text-[9.5px] font-normal uppercase tracking-[0.04em] text-muted-foreground">
              {recent.type}
            </span>
          </Link>
        </span>
      ))}
    </section>
  );
}

/* ========================================================================== *
 * Browse by intent — one FEATURED door (the most-trodden path, with concrete
 * example entries) over a compact list of the rest. Hierarchy, not five equal
 * doors: the eye lands on the common case first.
 * ========================================================================== */

function IntentDoors() {
  const [featured, ...rest] = INTENTS;
  return (
    <section>
      <SectionHead
        title="Browse by intent"
        description="Start from what you're trying to do."
        action={{ to: "/proto/guidance", label: "View all paths" }}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {featured ? <FeaturedDoor intent={featured} /> : null}
        <ul className="flex flex-col overflow-hidden rounded-[4px] border border-border bg-card">
          {rest.map((intent, i) => (
            <li key={intent.title} className={cn("flex-1", i > 0 && "border-t border-border")}>
              <Link
                to={intent.to}
                className={cn(
                  "group grid h-full items-baseline gap-x-4 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]",
                  "transition-colors hover:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
                    {intent.title}
                  </span>
                  <span className="truncate text-[12px] leading-[1.45] text-muted-foreground">
                    {intent.description}
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-1.5 sm:mt-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    {intent.lands}
                  </span>
                  <IconArrowRight
                    aria-hidden
                    className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeaturedDoor({ intent }: { intent: (typeof INTENTS)[number] }) {
  const Glyph = intent.icon;
  return (
    <div className="flex flex-col justify-between gap-4 rounded-[4px] border border-border bg-card p-5">
      <div className="flex flex-col gap-3">
        <span className="flex size-9 items-center justify-center rounded-[4px] bg-brand-tint text-brand-ink">
          <Glyph aria-hidden className="size-5" />
        </span>
        <Link
          to={intent.to}
          className="group flex w-fit items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground group-hover:text-brand-ink">
            {intent.title}
          </span>
          <IconArrowRight
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
          />
        </Link>
        <p className="max-w-[42ch] text-[13px] leading-[1.55] text-muted-foreground">
          {intent.description}
        </p>
      </div>
      {intent.examples ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3.5">
          {intent.examples.map((example) => (
            <Link
              key={example.label}
              to={example.to}
              className={cn(
                "rounded-[3px] border border-border-strong bg-card px-2.5 py-1 text-[12px] font-semibold text-foreground",
                "transition-colors hover:border-primary hover:text-brand-ink",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {example.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ========================================================================== *
 * Service catalog — a BOOK INDEX into /proto/catalog: columned link lines per
 * domain (name + count), typographic rather than tiled. The catalog page owns
 * the data; this is just its index.
 * ========================================================================== */

function CatalogIndex({
  serviceCount,
  domains,
}: {
  serviceCount: number;
  domains: HomeLoaderData["domains"];
}) {
  return (
    <section>
      <SectionHead
        title="Service catalog"
        description={`${serviceCount} services, grouped by domain. Jump straight to a shelf.`}
        action={{ to: "/proto/catalog", label: "View all services" }}
      />
      <ul className="gap-x-12 sm:columns-2 lg:columns-3">
        {domains.map((d) => (
          <li key={d.domain} className="break-inside-avoid">
            <Link
              to="/proto/catalog"
              search={{ variant: "specsheet" }}
              hash={d.anchor}
              className={cn(
                "group flex items-baseline justify-between gap-3 border-b border-border py-2.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate bg-background text-[13.5px] font-semibold text-foreground group-hover:text-brand-ink">
                  {d.domain}
                </span>
                <span className="truncate bg-background text-[11.5px] text-muted-foreground">
                  {d.preview}
                </span>
              </span>
              <span className="shrink-0 bg-background text-[12px] tabular-nums text-muted-foreground">
                {d.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ========================================================================== *
 * What changed — a date-led timeline with recency hierarchy: the newest entry
 * carries full weight, older ones compress. "View all" lands on the new
 * operations overview.
 * ========================================================================== */

function WhatChanged() {
  return (
    <section>
      <SectionHead title="What changed" action={{ to: "/proto/whatsnew", label: "View all" }} />
      <ol className="flex flex-col">
        {ANNOUNCEMENTS.map((a, i) => {
          const lead = i === 0;
          return (
            <li
              key={a.title}
              className={cn(
                "grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[110px_minmax(0,1fr)]",
                i > 0 && "border-t border-border",
              )}
            >
              <span className="bg-background font-mono text-[11px] tabular-nums leading-[1.6] text-muted-foreground">
                {a.date}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-2 rounded-full", ANNOUNCE_TONE[a.tone])} />
                  <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    {a.kind}
                  </span>
                  <span
                    className={cn(
                      "bg-background font-bold tracking-[-0.01em] text-foreground",
                      lead ? "text-[15px]" : "text-[13.5px]",
                    )}
                  >
                    {a.title}
                  </span>
                </span>
                <p
                  className={cn(
                    "w-fit max-w-[72ch] bg-background leading-[1.5] text-muted-foreground",
                    lead ? "text-[13.5px]" : "text-[12.5px]",
                  )}
                >
                  {a.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
