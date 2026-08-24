/**
 * Prototype `atlas` — shell
 * =========================
 * Implements docs/app-centric-experience-architecture.md §2–§3: the top bar is
 * one unchanging anchor with two stable states, and complexity lives inside the
 * deep-workspace layout.
 *
 * - Global state (Home / Onboard): logo left · intent tabs centred · search and
 *   theme right. No sidebar, no app switcher. The Ask Atlas FAB sits bottom-right.
 * - App state (inside an application): the intent tabs yield — the centre becomes
 *   a persistent Ask input (`Ask about {app}…`), the app identity + switcher move
 *   to the top-right corner, and a face rail grows on the left. The FAB hides.
 *
 * Visuals are Blueprint (DESIGN.md) via the shipped portal's tokens: 56px opaque
 * bar, hairlines, coordinate grid in negative space. No colours are added here.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  IconCheck,
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSearch,
} from "@tabler/icons-react";

import logoSvg from "@/assets/logo.svg?url";
import { ThemeToggle } from "@/components/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeProvider } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { APPLICATIONS, CURRENT_USER, healthDot, type Application } from "./fixtures";
import { FACES, faceById, type FaceId } from "./faces";
import { StatusDot } from "./ui";
import "./atlas.css";

const SCOPE_CLASS = "proto-atlas";

/* ------------------------------------------------------------------ */
/* Providers + scope                                                   */
/* ------------------------------------------------------------------ */

function PrototypeChrome({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(SCOPE_CLASS);
    return () => root.classList.remove(SCOPE_CLASS);
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider delay={200}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

const TOP_BAR =
  "sticky top-0 z-40 grid h-14 grid-cols-[auto_1fr] items-center gap-3 border-b border-border bg-background px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8";

function BrandLink() {
  return (
    <Link
      to="/prototype"
      aria-label="Atlas home"
      className={cn(
        "mr-1 flex shrink-0 items-center gap-2.5 rounded-md py-1 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <img src={logoSvg} alt="" aria-hidden className="size-6 shrink-0" />
      <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />
      <span className="hidden text-[15px] font-bold tracking-[-0.03em] text-foreground sm:inline">
        Atlas
      </span>
    </Link>
  );
}

function IntentTabs() {
  const tabs = [
    { to: "/prototype", label: "Home", exact: true },
    { to: "/prototype/onboard", label: "Onboard", exact: false },
  ] as const;

  return (
    <nav aria-label="Primary" className="hidden items-center justify-center gap-1 md:flex">
      {tabs.map((tab) => (
        <TabLink key={tab.to} to={tab.to} label={tab.label} activeOptions={{ exact: tab.exact }} />
      ))}
      {/* Catalog reuses the shipped pilot implementation unchanged (§7). */}
      <a
        href="/catalog"
        className={cn(
          "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Catalog
      </a>
    </nav>
  );
}

function TabLink({
  to,
  label,
  activeOptions,
}: {
  to: string;
  label: string;
  activeOptions: { exact: boolean };
}) {
  return (
    <Link
      to={to}
      activeOptions={activeOptions}
      activeProps={{ "data-active": "true" } as Record<string, string>}
      className={cn(
        // Active = brand underline, no tinted pill (DESIGN.md §4 tabs).
        "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
        "data-[active=true]:rounded-b-none data-[active=true]:font-semibold data-[active=true]:text-foreground",
        "data-[active=true]:shadow-[inset_0_-2px_0_var(--color-brand)] data-[active=true]:hover:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {label}
    </Link>
  );
}

/** Global-state Ask entry: a quiet affordance; the overlay arrives later. */
function SearchIconButton() {
  return (
    <button
      type="button"
      title="Search and Ask arrive in a later batch"
      onClick={(event) => event.preventDefault()}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconSearch size={17} strokeWidth={2} aria-hidden />
      <span className="sr-only">Search</span>
    </button>
  );
}

/** Brand pill fixed bottom-right — global state only (§3). */
function AskAtlasFab() {
  return (
    <button
      type="button"
      title="Ask Atlas arrives in a later batch"
      onClick={(event) => event.preventDefault()}
      className={cn(
        "fixed right-6 bottom-6 z-90 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-semibold text-brand-foreground",
        "shadow-[0_6px_16px_oklch(23%_0.03_264.18/0.18)] transition-colors hover:bg-primary/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <IconSearch size={15} aria-hidden />
      Ask Atlas
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Shells                                                              */
/* ------------------------------------------------------------------ */

export function GlobalShell({ children }: { children: ReactNode }) {
  return (
    <PrototypeChrome>
      <div
        className={cn(SCOPE_CLASS, "flex min-h-dvh w-full flex-col bg-background text-foreground")}
      >
        <header className={TOP_BAR}>
          <div className="flex min-w-0 items-center">
            <BrandLink />
          </div>
          <IntentTabs />
          <div className="flex items-center justify-end gap-1">
            <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
              Fixture prototype
            </span>
            <SearchIconButton />
            <ThemeToggle />
          </div>
        </header>
        <main className="min-w-0 flex-1 bg-coordinate-grid">{children}</main>
        <AskAtlasFab />
      </div>
    </PrototypeChrome>
  );
}

export function AppShell({
  application,
  children,
}: {
  application: Application;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <PrototypeChrome>
      <div
        className={cn(SCOPE_CLASS, "flex min-h-dvh w-full flex-col bg-background text-foreground")}
      >
        <header className={TOP_BAR}>
          <div className="flex min-w-0 items-center">
            <BrandLink />
          </div>
          {/* Centre yields to the persistent Ask input (§3). */}
          <form
            role="search"
            onSubmit={(event: FormEvent) => event.preventDefault()}
            className="hidden justify-center px-4 md:flex"
          >
            <label className="relative flex w-full max-w-md min-w-0 items-center">
              <IconSearch
                size={15}
                aria-hidden
                className="pointer-events-none absolute left-2.5 text-muted-foreground"
              />
              <input
                type="text"
                placeholder={`Ask about ${application.name}…`}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                className={cn(
                  "h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] text-foreground",
                  "placeholder:text-muted-foreground",
                  "focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/30",
                )}
              />
            </label>
          </form>
          <div className="flex items-center justify-end gap-1.5">
            <AppSwitcher application={application} />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <FaceRail
            application={application}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
          />
          <main className="min-w-0 flex-1 bg-coordinate-grid">
            <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PrototypeChrome>
  );
}

/* ------------------------------------------------------------------ */
/* Face rail                                                           */
/* ------------------------------------------------------------------ */

function FaceRail({
  application,
  collapsed,
  onToggle,
}: {
  application: Application;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const coreFaces = FACES.filter((face) => face.core);
  const laterFaces = FACES.filter((face) => !face.core);

  return (
    <aside
      className={cn(
        "proto-sidebar sticky top-14 hidden h-[calc(100dvh-56px)] shrink-0 flex-col border-r border-border md:flex",
        collapsed ? "w-12" : "w-60",
      )}
    >
      {/* App identity anchor. */}
      <div className="flex items-start gap-2 px-3 pt-4 pb-3">
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusDot state={healthDot(application)} />
              <p className="truncate text-[13px] font-bold tracking-[-0.01em] text-foreground">
                {application.name}
              </p>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] font-semibold tracking-[0.01em] text-muted-foreground">
              {application.code} · {application.team}
            </p>
          </div>
        ) : (
          <span
            className="grid size-6 place-items-center"
            title={`${application.name} (${application.code})`}
          >
            <StatusDot state={healthDot(application)} />
          </span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse navigation"
            title="Collapse navigation"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
              "hover:bg-secondary hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <IconLayoutSidebarLeftCollapse size={15} aria-hidden />
          </button>
        )}
      </div>

      <nav aria-label="Application faces" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul className="flex flex-col gap-0.5">
          {coreFaces.map((face) => (
            <FaceLink key={face.id} face={face} appId={application.id} collapsed={collapsed} />
          ))}
        </ul>

        <div className="my-3 border-t border-border" role="presentation" />
        {!collapsed && (
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Later
          </p>
        )}
        <ul className="flex flex-col gap-0.5">
          {laterFaces.map((face) => (
            <FaceLink
              key={face.id}
              face={face}
              appId={application.id}
              collapsed={collapsed}
              planned={!face.core}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-2">
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand navigation"
            title="Expand navigation"
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <IconLayoutSidebarLeftExpand size={15} aria-hidden />
          </button>
        ) : (
          <FaceRailFooter application={application} onToggle={onToggle} />
        )}
      </div>
    </aside>
  );
}

function FaceLink({
  face,
  appId,
  collapsed,
  planned = false,
}: {
  face: (typeof FACES)[number];
  appId: string;
  collapsed: boolean;
  planned?: boolean;
}) {
  const label = face.shortLabel ?? face.label;
  return (
    <li>
      <Link
        to={`/prototype/$appId/${face.id}`}
        params={{ appId }}
        activeProps={{ "data-active": "true" } as Record<string, string>}
        title={collapsed ? face.label : undefined}
        className={cn(
          "group flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
          "text-muted-foreground hover:bg-card hover:text-foreground",
          "data-[active=true]:bg-brand-tint data-[active=true]:font-semibold data-[active=true]:text-brand-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          planned && "opacity-70 hover:opacity-100",
        )}
      >
        <face.icon size={16} aria-hidden className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

function FaceRailFooter({
  application,
  onToggle,
}: {
  application: Application;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1">
      <p className="min-w-0 truncate text-[11px] text-muted-foreground">
        <span className="font-mono font-semibold">{application.code}</span> ·{" "}
        {application.lifecycle === "onboarding" ? "onboarding" : "operating"}
      </p>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Collapse navigation"
        title="Collapse navigation"
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-secondary hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconLayoutSidebarLeftCollapse size={15} aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App switcher                                                        */
/* ------------------------------------------------------------------ */

/** Swaps the application id while keeping the current face segment. */
function useCurrentFaceId(): FaceId {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const segments = pathname.split("/").filter(Boolean);
  // /prototype/{appId}/{face} → segment 3 names the face.
  return faceById(segments[2] ?? "")?.id ?? "overview";
}

function AppSwitcher({ application }: { application: Application }) {
  const faceId = useCurrentFaceId();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-left transition-colors hover:border-border-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span
              aria-hidden
              className="grid size-5 shrink-0 place-items-center rounded-[3px] bg-brand-tint text-[10px] font-bold text-brand-ink"
            >
              ❖
            </span>
            <span className="max-w-[160px] truncate font-mono text-[12px] font-semibold text-foreground lg:max-w-none">
              {application.code}
            </span>
            <IconChevronDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent align="end" className="w-[300px] gap-0 p-0">
        <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Applications for {CURRENT_USER}
        </p>
        <ul className="flex flex-col p-1">
          {APPLICATIONS.map((candidate) => {
            const current = candidate.id === application.id;
            return (
              <li key={candidate.id}>
                <Link
                  to={`/prototype/$appId/${faceId}`}
                  params={{ appId: candidate.id }}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-secondary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="mt-0.5 grid size-4 shrink-0 place-items-center">
                    {current ? (
                      <IconCheck size={15} aria-hidden className="text-brand-ink" />
                    ) : null}
                  </span>
                  <StatusDot state={healthDot(candidate)} className="mt-[7px]" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-mono text-[11px] font-semibold text-foreground">
                        {candidate.code}
                      </span>
                      <span className="truncate text-[12px] font-medium text-foreground">
                        {candidate.name}
                      </span>
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {candidate.team} ·{" "}
                      {candidate.lifecycle === "onboarding" ? "onboarding" : "operating"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-3 py-2 text-[11px] leading-[1.45] text-muted-foreground">
          Switching keeps your current face. Home routes by identity, not by app.
        </p>
      </PopoverContent>
    </Popover>
  );
}
