/**
 * Prototype `opus` — shell
 * ========================
 * A workbench frame rather than a document page: a persistent rail carrying the
 * application context and the four surfaces, panels floating on a darker chrome.
 * This is deliberately a different structure from the shipped portal (centred
 * document, top tabs), while keeping the #001AFF brand for action and selection.
 *
 * The scope class is applied to <html> as well as the wrapper so portalled
 * popovers and tooltips inherit the prototype's tokens.
 */
import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  IconCheck,
  IconChevronDown,
  IconLayoutDashboard,
  IconRoute,
  IconSend,
  IconStethoscope,
} from "@tabler/icons-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeProvider } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { APPLICATIONS } from "./fixtures";
import type { Application } from "./fixtures/types";
import { attentionItems, journeySummary } from "./fixtures/derive";
import { ProvenanceLegend, StateChip } from "./ui";
import "./theme.css";

const SCOPE_CLASS = "proto-opus";

const NAV = [
  {
    to: "/prototype/opus/dashboard",
    label: "Workbench",
    hint: "State of your work",
    icon: IconLayoutDashboard,
  },
  {
    to: "/prototype/opus/onboarding",
    label: "Journey",
    hint: "Path to first DEV deploy",
    icon: IconRoute,
  },
  {
    to: "/prototype/opus/scaffolder",
    label: "Request",
    hint: "Governed actions",
    icon: IconSend,
  },
  {
    to: "/prototype/opus/diagnosis",
    label: "Diagnosis",
    hint: "Why it failed",
    icon: IconStethoscope,
  },
] as const;

export function PrototypeShell({
  application,
  children,
}: {
  application: Application;
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(SCOPE_CLASS);
    return () => root.classList.remove(SCOPE_CLASS);
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider delay={200}>
        <div
          className={cn(SCOPE_CLASS, "flex min-h-dvh w-full flex-col bg-background lg:flex-row")}
        >
          <Rail application={application} />
          <div className="flex min-w-0 flex-1 flex-col">
            <FixtureBar />
            <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function Rail({ application }: { application: Application }) {
  const summary = journeySummary(application);
  const attention = attentionItems(application);
  const needsAttention = attention.filter((item) => item.urgency <= 2).length;

  return (
    <div className="flex shrink-0 flex-col border-b border-[var(--proto-chrome-border)] bg-[var(--proto-chrome)] lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2 px-3.5 py-3 lg:px-4">
        <Link
          to="/prototype/opus/dashboard"
          search={{ app: application.id }}
          className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-[4px] bg-brand text-[11px] font-bold text-brand-foreground"
          >
            A
          </span>
          <span className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-foreground">
            Atlas
          </span>
          <span className="shrink-0 rounded-[3px] border border-border-strong px-1 py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            opus
          </span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="px-3.5 pb-3 lg:px-4">
        <ApplicationSwitcher application={application} />
      </div>

      <nav aria-label="Prototype surfaces" className="px-2 pb-3 lg:px-2.5">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <li key={item.to} className="shrink-0 lg:shrink">
              <Link
                to={item.to}
                search={{ app: application.id }}
                activeProps={{ "data-active": "true" } as Record<string, string>}
                className={cn(
                  "group flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors",
                  "hover:bg-card hover:text-foreground",
                  "data-[active=true]:bg-card data-[active=true]:font-semibold data-[active=true]:text-foreground data-[active=true]:shadow-[inset_2px_0_0_var(--brand)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <item.icon size={16} aria-hidden className="shrink-0" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                    {item.hint}
                  </span>
                </span>
                {item.label === "Workbench" && needsAttention > 0 ? (
                  <span className="proto-num ml-auto hidden shrink-0 rounded-full bg-[var(--proto-tint-stop)] px-1.5 py-px text-[11px] font-semibold text-[var(--critical-ink)] lg:block">
                    {needsAttention}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto hidden flex-col gap-3 border-t border-[var(--proto-chrome-border)] px-4 py-3.5 lg:flex">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Journey
          </p>
          <p className="proto-num text-[12px] text-foreground">
            {summary.complete} of {summary.applicable} steps complete
          </p>
          {summary.blockingStep === undefined ? (
            <StateChip state="verified" label="Nothing blocking" />
          ) : (
            <StateChip state={summary.blockingStep.state} />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            How Atlas knows
          </p>
          <ProvenanceLegend />
        </div>
      </div>
    </div>
  );
}

function ApplicationSwitcher({ application }: { application: Application }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-left transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 flex-col">
              <span className="proto-id truncate text-foreground">{application.code}</span>
              <span className="truncate text-[11px] text-muted-foreground">{application.name}</span>
            </span>
            <IconChevronDown
              size={14}
              aria-hidden
              className="ml-auto shrink-0 text-muted-foreground"
            />
          </button>
        }
      />
      <PopoverContent align="start" className="w-[280px] gap-0 p-0">
        <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Applications you own
        </p>
        <ul className="flex flex-col p-1">
          {APPLICATIONS.map((candidate) => {
            const current = candidate.id === application.id;
            return (
              <li key={candidate.id}>
                <Link
                  to={pathname}
                  search={{ app: candidate.id }}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="mt-0.5 size-4 shrink-0">
                    {current ? (
                      <IconCheck size={16} aria-hidden className="text-brand-ink" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className="proto-id text-foreground">{candidate.code}</span>
                      <span className="truncate text-[12px] font-medium text-foreground">
                        {candidate.name}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {candidate.team} · {candidate.workloadPattern} ·{" "}
                      {candidate.lifecycle === "onboarding" ? "onboarding" : "operating"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-border px-3 py-2 text-[11px] leading-[1.45] text-muted-foreground">
          Application context follows you across all four surfaces.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function FixtureBar() {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-[var(--proto-tint-info)] px-4 py-1.5 text-[11.5px] leading-[1.45] text-[var(--info-ink)] sm:px-6 lg:px-8">
      <span className="font-semibold">Fixture prototype</span>
      <span>
        Fictional applications and records. Actions are simulated: nothing is sent to any system, no
        access is granted, and no approval is made on anyone&rsquo;s behalf.
      </span>
    </p>
  );
}
