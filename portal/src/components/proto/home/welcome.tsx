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
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { JourneyGrid } from "@/components/home/journey-grid";
import { IntentSearch } from "@/components/intent-search";
import { cn } from "@/lib/utils";

import { CHANGES, TONE_DOT } from "@/components/proto/whatsnew/data";

import {
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
    </div>
  );
}

/* ========================================================================== *
 * What's new ticker — the changelog as a HERO MARQUEE: recent platform changes
 * scroll across one hairline band under the hero. The whole band links to the
 * full broadsheet; hover pauses the scroll; reduced-motion renders it static.
 * ========================================================================== */

const TICKER_CHANGES = CHANGES.slice(0, 8);

function WhatsNewTicker() {
  return (
    <Link
      to="/proto/whatsnew"
      aria-label="What's new — read the full dispatch"
      className="group flex w-full items-center gap-4 border-y border-border py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex shrink-0 items-center gap-1.5 bg-background font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-ink">
        What&rsquo;s new
        <IconArrowRight aria-hidden className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
        <div className="flex w-max animate-[proto-marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          <TickerTrack />
          <TickerTrack ariaHidden />
        </div>
      </div>
    </Link>
  );
}

function TickerTrack({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div aria-hidden={ariaHidden || undefined} className="flex shrink-0 items-center">
      {TICKER_CHANGES.map((change) => (
        <span key={change.id} className="flex items-center gap-2 whitespace-nowrap px-6">
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[change.tone])} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {change.kind}
          </span>
          <span className="text-[12.5px] text-foreground/80">{change.title}</span>
        </span>
      ))}
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
      {/* The What's-new ticker stands in for the eyebrow: the platform's pulse
          above the welcome, not a static label. */}
      <WhatsNewTicker />
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
 * Browse by intent — intent-driven entry: guess where the user is headed and
 * give the fastest door. The "Focus" register: a collapsed sentence list where
 * the focused row expands editorially (verb eyebrow + big title + the why).
 * Hover moves the focus; default falls on the first (the platform's bet).
 * ========================================================================== */

function IntentDoors() {
  return (
    <section>
      <SectionHead
        title="Browse by intent"
        description="Tell us what you're here to do — we'll put the fastest door first."
        action={{ to: "/proto/guidance", label: "View all paths" }}
      />
      <IntentFocus />
    </section>
  );
}

function IntentFocus() {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? 0;
  return (
    <ol className="flex flex-col" onMouseLeave={() => setHovered(null)}>
      {INTENTS.map((intent, i) => {
        const open = i === active;
        return (
          <li
            key={intent.title}
            onMouseEnter={() => setHovered(i)}
            className={cn(i > 0 && "border-t border-border")}
          >
            <Link
              to={intent.to}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "w-fit bg-background font-mono font-semibold uppercase tracking-[0.14em] transition-all duration-200",
                    open
                      ? "mb-1 text-[10px] text-muted-foreground group-hover:text-brand-ink"
                      : "mb-0 text-[0px] opacity-0",
                  )}
                >
                  {intent.verb}
                </span>
                <span
                  className={cn(
                    "w-fit bg-background font-bold tracking-[-0.02em] transition-all duration-200 group-hover:text-brand-ink",
                    open ? "text-[1.5rem] leading-[1.1] text-foreground" : "text-[1.0625rem] text-foreground/55",
                  )}
                >
                  {intent.title}
                </span>
                <div
                  className={cn(
                    "grid transition-all duration-200",
                    open ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <p className="w-fit max-w-[54ch] overflow-hidden bg-background text-[13px] leading-[1.5] text-muted-foreground">
                    {intent.description}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1.5 self-center bg-background font-mono text-[10px] uppercase tracking-[0.06em] transition-colors duration-200 group-hover:text-brand-ink",
                  open ? "text-muted-foreground" : "text-muted-foreground/50",
                )}
              >
                {intent.lands}
                <IconArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
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

