/**
 * Home direction "Welcome desk".
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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Await, CatchBoundary, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { IconArrowLeft, IconArrowRight, IconMessageCircle } from "@tabler/icons-react";
import { AnimatePresence, LazyMotion, MotionConfig, m, type Variants } from "motion/react";

import { useAskAtlas } from "@/components/ask-atlas/context";
import { JourneyGrid } from "@/components/home/journey-grid";
import { IntentSearch } from "@/components/intent-search";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ENTRY_DOT } from "@/components/catalog/data";

import { RecentlyViewed } from "@/components/home/recently-viewed";
import {
  INTENTS,
  POPULAR,
  type DomainService,
  type HomeAnnouncement,
  type HomeLoaderData,
  type HomeStats,
  type MainlineRoute,
} from "./data";

// Load motion's DOM feature bundle (~26 kB gzip) lazily so it stays off the
// home page's first paint — it loads when the catalog swap first animates.
const loadDomAnimation = () => import("motion/react").then((mod) => mod.domAnimation);

/* Home defers its live data (availability stats, the What's-new feed). Unlike the
 * detail surfaces, a home failure must NOT take over the page or offer an in-place
 * retry — the page stays welcoming. A failed region simply drops out (renders
 * nothing) and a single deduped toast notes that some live figures are missing. */
function HomeDeferred<T>({
  promise,
  fallback,
  children,
}: {
  promise: Promise<T>;
  fallback: ReactNode;
  children: (value: T) => ReactNode;
}) {
  return (
    <CatchBoundary getResetKey={() => "home"} errorComponent={() => <HomeDeferredFallback />}>
      <Await promise={promise} fallback={fallback}>
        {children}
      </Await>
    </CatchBoundary>
  );
}

function HomeDeferredFallback() {
  useEffect(() => {
    toast.error("Some live data couldn’t load", {
      // Shared id: several home regions may fail at once, but the user sees one toast.
      id: "home-live-data",
      description: "The page is still usable — live figures will return shortly.",
    });
  }, []);
  return null;
}

export function HomeWelcome({ data }: { data: HomeLoaderData }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-8">
        <Hero announcements={data.announcements} stats={data.stats} />
        <ResumeBand />
      </div>
      <IntentDoors />
      <section>
        <SectionHead
          title="From idea to production"
          description="Follow the lifecycle or jump to what you need right now."
        />
        <JourneyGrid />
      </section>
      <HomeDeferred promise={data.stats} fallback={<CatalogIndexSkeleton />}>
        {(stats) => <CatalogIndex serviceCount={stats.serviceCount} domains={stats.domains} />}
      </HomeDeferred>
      <HelpCloser />
    </div>
  );
}

/* ========================================================================== *
 * What's new ticker — the changelog as a HERO MARQUEE: recent platform changes
 * scroll across one hairline band under the hero. The whole band links to the
 * full broadsheet; hover pauses the scroll; reduced-motion renders it static.
 * ========================================================================== */

function WhatsNewTicker({ announcements }: { announcements: ReadonlyArray<HomeAnnouncement> }) {
  // Pause the infinite marquee whenever it's scrolled out of the viewport so it
  // stops waking the compositor on low-power machines (browsers already throttle
  // it in background tabs; this covers the on-page scrolled-away case).
  const viewportRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (announcements.length === 0) return null;
  return (
    <Link
      to="/whatsnew"
      aria-label="What's new — read the full dispatch"
      className="group flex w-full items-center gap-4 border-y border-border py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-ink">
        What&rsquo;s new
        <IconArrowRight
          aria-hidden
          className="size-3 transition-transform group-hover:translate-x-0.5"
        />
      </span>
      <div
        ref={viewportRef}
        className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]"
      >
        <div
          className={cn(
            "flex w-max animate-[proto-marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none",
            paused && "[animation-play-state:paused]",
          )}
        >
          <TickerTrack announcements={announcements} />
          <TickerTrack announcements={announcements} ariaHidden />
        </div>
      </div>
    </Link>
  );
}

function TickerTrack({
  announcements,
  ariaHidden = false,
}: {
  announcements: ReadonlyArray<HomeAnnouncement>;
  ariaHidden?: boolean;
}) {
  return (
    <div aria-hidden={ariaHidden || undefined} className="flex shrink-0 items-center">
      {announcements.map((item, i) => (
        <span key={`${item.title}-${i}`} className="flex items-center gap-2 whitespace-nowrap px-6">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {item.kind}
          </span>
          <span className="text-[12.5px] text-foreground/80">{item.title}</span>
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
  action?: { to: MainlineRoute; label: string };
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="w-fit text-[1.375rem] font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="w-fit text-[13.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          to={action.to}
          className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline"
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
  announcements,
  stats,
}: {
  announcements: Promise<ReadonlyArray<HomeAnnouncement>>;
  stats: Promise<HomeStats>;
}) {
  return (
    <section className="flex flex-col items-center gap-5 text-center">
      {/* The What's-new ticker stands in for the eyebrow: the platform's pulse
          above the welcome, not a static label. */}
      <HomeDeferred promise={announcements} fallback={<TickerSkeleton />}>
        {(announcements) => <WhatsNewTicker announcements={announcements} />}
      </HomeDeferred>
      <h1 className="w-fit max-w-[18ch] text-[2.5rem] font-bold leading-[1.05] tracking-[-0.035em] text-balance text-foreground">
        Welcome to the Cloud DevEx Portal
      </h1>
      <p className="w-fit max-w-[52ch] text-[1.0625rem] leading-[1.55] text-pretty text-muted-foreground">
        Find the right guidance, services, and evidence to build with confidence. Every claim links
        back to its source.
      </p>
      <div className="flex w-full max-w-[600px] flex-col items-center gap-3 pt-1">
        <IntentSearch className="h-12 w-full" />
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Popular</span>
          {POPULAR.map((q) => (
            <Link
              key={q}
              to="/catalog"
              className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {q}
            </Link>
          ))}
        </div>
      </div>
      <dl className="flex flex-wrap justify-center gap-x-7 gap-y-2 pt-1">
        <HomeDeferred promise={stats} fallback={<StatsSkeleton />}>
          {(s) => (
            <>
              <Stat value={s.serviceCount} label="services" />
              <Stat value={s.domainCount} label="domains" />
              <Stat value={s.regionCount} label="regions & outposts" />
            </>
          )}
        </HomeDeferred>
      </dl>
    </section>
  );
}

/** Placeholder for the What's-new ticker while the (live) feed resolves. */
function TickerSkeleton() {
  return <Skeleton aria-hidden className="h-6 w-72 rounded-full" />;
}

/** Placeholder for the three hero stat numbers while availability resolves. */
function StatsSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-baseline gap-1.5">
          <Skeleton className="h-5 w-7" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
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
  // Real recently-viewed (localStorage). Renders nothing when there's no
  // click history yet — no lead, no empty-state copy.
  return <RecentlyViewed lead="Pick up where you left off" />;
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
        action={{ to: "/guidance", label: "View all paths" }}
      />
      <IntentFocus />
    </section>
  );
}

function IntentFocus() {
  // Pure-CSS focus (see `.intent-list` in globals.css): default-open first row,
  // hover opens another. No React state, so it works before hydration — a slow
  // deferred-data load can never block the animation.
  return (
    <ol className="intent-list flex flex-col">
      {INTENTS.map((intent, i) => (
        <li key={intent.title} className={cn("intent-row", i > 0 && "border-t border-border")}>
          <Link
            to={intent.to}
            className="group/row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 flex-col">
              <span className="intent-eyebrow w-fit font-mono font-semibold uppercase tracking-[0.14em] transition-[font-size,opacity,color,margin] duration-200 group-hover/row:text-brand-ink">
                {intent.verb}
              </span>
              <span className="intent-title w-fit font-bold tracking-[-0.02em] transition-[font-size,color] duration-200 group-hover/row:text-brand-ink">
                {intent.title}
              </span>
              <div className="intent-reveal grid transition-[grid-template-rows,opacity] duration-200">
                <p className="w-fit max-w-[54ch] overflow-hidden text-[13px] leading-[1.5] text-muted-foreground">
                  {intent.description}
                </p>
              </div>
            </div>
            <span className="intent-lands flex items-center gap-1.5 self-center font-mono text-[10px] uppercase tracking-[0.06em] transition-colors duration-200 group-hover/row:text-brand-ink">
              {intent.lands}
              <IconArrowRight
                aria-hidden
                className="size-3.5 transition-transform group-hover/row:translate-x-0.5"
              />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/* ========================================================================== *
 * Service catalog — a first-level domain index (the original typographic book
 * index). Click a domain and the whole index is REPLACED, in place, by that
 * domain's SPEC SHEET (its services as a flowing, status-dotted, columned
 * list) — the spec-sheet form used where it belongs, one bounded domain at a
 * time.
 *
 * Motion: AnimatePresence (mode="wait") cleanly swaps index ↔ detail. On the
 * detail, the label glides in from the left, then the service lines rise and
 * fade in a gentle stagger — physics-based easing, small travel, so it reads
 * calm rather than busy. reducedMotion="user" drops the transforms.
 * ========================================================================== */

/**
 * Click → switch transition ("push"): the index list slides out to the left as
 * the chosen domain's detail pushes in from the right, its service lines fading
 * in a quick light stagger. A drawer-style master→detail move.
 */
const INDEX_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -28 },
  show: { opacity: 1, x: 0, transition: { duration: 0.22, ease: "easeOut" } },
  exit: { opacity: 0, x: -28, transition: { duration: 0.18, ease: "easeIn" } },
};
const DETAIL_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, ease: "easeOut", staggerChildren: 0.02 },
  },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const LIST_VARIANTS: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const LINE_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** Placeholder for the deferred domain index (book-index columns). */
function CatalogIndexSkeleton() {
  return (
    <section aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-48" />
      <div className="gap-x-12 sm:columns-2 lg:columns-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="mb-3 h-8 w-full" />
        ))}
      </div>
    </section>
  );
}

function CatalogIndex({
  serviceCount,
  domains,
}: {
  serviceCount: number;
  domains: HomeStats["domains"];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const domain = selected ? domains.find((d) => d.domain === selected) : undefined;

  return (
    <section>
      <SectionHead
        title="Service catalog"
        description={`${serviceCount} services across ${domains.length} domains. Open one to see what's in it.`}
        action={{ to: "/catalog", label: "View all services" }}
      />
      <LazyMotion features={loadDomAnimation}>
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait" initial={false}>
            {domain ? (
              <m.div
                key={domain.domain}
                variants={DETAIL_VARIANTS}
                initial="hidden"
                animate="show"
                exit="exit"
                className="grid gap-x-12 gap-y-4 lg:grid-cols-[220px_minmax(0,1fr)]"
              >
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="group flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <IconArrowLeft
                      aria-hidden
                      className="size-3.5 transition-transform group-hover:-translate-x-0.5"
                    />
                    All domains
                  </button>
                  <h3 className="w-fit text-[1.25rem] font-bold tracking-[-0.02em] text-foreground">
                    {domain.domain}
                  </h3>
                  <span className="w-fit font-mono text-[11px] tabular-nums text-muted-foreground">
                    {domain.count} services
                  </span>
                  {domain.blurb ? (
                    <p className="w-fit max-w-[30ch] text-[12.5px] leading-[1.5] text-muted-foreground">
                      {domain.blurb}
                    </p>
                  ) : null}
                </div>
                <m.ul variants={LIST_VARIANTS} className="grid gap-x-10 sm:grid-cols-2">
                  {domain.services.map((service) => (
                    <ServiceLine key={service.id} service={service} variants={LINE_VARIANTS} />
                  ))}
                </m.ul>
              </m.div>
            ) : (
              <m.ul
                key="index"
                variants={INDEX_VARIANTS}
                initial="hidden"
                animate="show"
                exit="exit"
                className="gap-x-12 sm:columns-2 lg:columns-3"
              >
                {domains.map((d) => (
                  <li key={d.domain} className="break-inside-avoid">
                    <button
                      type="button"
                      onClick={() => setSelected(d.domain)}
                      className="group flex w-full items-baseline justify-between gap-3 border-b border-border py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-brand-ink">
                          {d.domain}
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground">
                          {d.preview}
                        </span>
                      </span>
                      <span className="shrink-0 self-center text-[12px] tabular-nums text-muted-foreground">
                        {d.count}
                      </span>
                    </button>
                  </li>
                ))}
              </m.ul>
            )}
          </AnimatePresence>
        </MotionConfig>
      </LazyMotion>
    </section>
  );
}

function ServiceLine({ service, variants }: { service: DomainService; variants: Variants }) {
  const note =
    service.status === "ga"
      ? `${service.liveRegions} live${service.plannedRegions ? ` · ${service.plannedRegions} planned` : ""}`
      : service.status === "planned"
        ? "planned"
        : "not offered";
  return (
    <m.li variants={variants}>
      <Link
        to="/catalog"
        className="group flex items-baseline gap-2.5 border-b border-border/60 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 self-center rounded-full", ENTRY_DOT[service.status])}
        />
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground underline decoration-border underline-offset-[3px] group-hover:text-brand-ink group-hover:decoration-current">
          {service.name}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {note}
        </span>
      </Link>
    </m.li>
  );
}

/* ========================================================================== *
 * Help closer — the page's final band, and the resting home of the Ask action.
 * It is marked [data-fab-dismiss], so when it scrolls into view the floating
 * FAB fades out and THIS becomes the live ask affordance: same overlay, fuller
 * invitation. One ask control at a time — no overlap, no redundancy.
 * ========================================================================== */

function HelpCloser() {
  const { openOverlay } = useAskAtlas();
  return (
    <section
      data-fab-dismiss
      className="flex flex-col items-center gap-3 border-t border-border py-7 text-center"
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-ink">
        <IconMessageCircle aria-hidden className="size-3.5" />
        Ask
      </span>
      <h2 className="w-fit max-w-[28ch] text-[1.25rem] font-bold tracking-[-0.02em] text-foreground">
        Didn&rsquo;t find it? Just ask.
      </h2>
      <p className="w-fit max-w-[50ch] text-[13px] leading-[1.55] text-muted-foreground">
        Describe what you&rsquo;re trying to do in plain language. Every answer links back to the
        guidance, service, or policy it came from.
      </p>
      {/* Same icon + shape as the floating FAB — this is its resting form. */}
      <button
        type="button"
        onClick={() => openOverlay("ask")}
        className="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <IconMessageCircle aria-hidden className="size-4" />
        Ask
      </button>
    </section>
  );
}
