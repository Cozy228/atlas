import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconBell,
  IconBox,
  IconChevronDown,
  IconDatabase,
  IconMenu2,
  IconX,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { APP_CONTEXT } from "./fixtures";
import atlasMark from "./atlas-mark.png";
import "./theme.css";

const NAV_ITEMS = [
  { to: "/prototype/codex/dashboard", label: "My work" },
  { to: "/prototype/codex/dashboard", label: "Applications" },
  { to: "/prototype/codex/onboarding", label: "Journeys" },
  { to: "/prototype/codex/scaffolder", label: "Actions" },
  { to: "/prototype/codex/diagnosis", label: "Diagnose" },
] as const;

const MOBILE_NAV_ID = "codex-prototype-navigation";

export function CodexPrototypeShell({ children }: { children: ReactNode }) {
  return (
    <div className="codex-prototype flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#codex-main-content"
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/98 px-4 sm:pr-12">
        <Link
          to="/prototype/codex/dashboard"
          aria-label="Atlas prototype home"
          className="mr-7 flex shrink-0 items-center gap-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img src={atlasMark} alt="" aria-hidden className="size-8 object-cover" />
          <span className="text-[1.45rem] font-bold tracking-[-0.045em]">Atlas</span>
        </Link>

        <nav aria-label="Prototype" className="hidden h-full items-stretch xl:flex">
          {NAV_ITEMS.map((item, index) => (
            <Link
              key={`${item.label}-${index}`}
              to={item.to}
              activeOptions={{ exact: item.label === "My work" }}
              activeProps={
                item.label === "Applications"
                  ? undefined
                  : ({ "data-active": "true" } as Record<string, string>)
              }
              data-prototype-nav-link
              className="flex items-center rounded-sm px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-4">
          <details className="relative hidden md:block" data-app-menu>
            <summary className="flex h-11 w-[222px] min-w-0 cursor-pointer list-none items-center gap-2.5 rounded-md border border-border bg-card px-3 text-left hover:bg-muted">
              <IconBox className="size-5 shrink-0 text-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{APP_CONTEXT.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {APP_CONTEXT.code} · {APP_CONTEXT.environment}
                </span>
              </span>
              <IconChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </summary>
            <div className="absolute top-[calc(100%+8px)] right-0 z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
              <p className="text-sm font-semibold">Current fixture application</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This exploration contains one deterministic application so every route keeps the
                same context.
              </p>
            </div>
          </details>

          <span className="hidden h-11 min-w-[132px] items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground sm:flex">
            <IconDatabase className="size-4" aria-hidden />
            Fixture data
          </span>

          <button
            type="button"
            aria-label="Notifications"
            className="hidden size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
          >
            <IconBell className="size-5" aria-hidden />
          </button>

          <span
            aria-label="Signed in as JD"
            className="hidden size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground sm:flex"
          >
            JD
          </span>

          <button
            type="button"
            aria-label="Open prototype navigation"
            aria-haspopup="dialog"
            popoverTarget={MOBILE_NAV_ID}
            popoverTargetAction="show"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground xl:hidden"
          >
            <IconMenu2 className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      <div
        id={MOBILE_NAV_ID}
        popover="auto"
        role="dialog"
        aria-label="Prototype navigation"
        className="fixed inset-y-0 right-0 z-50 m-0 h-dvh w-[min(86vw,340px)] border-0 border-l border-border bg-popover p-0 text-popover-foreground shadow-lg"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-semibold">Atlas prototype</span>
          <button
            type="button"
            aria-label="Close prototype navigation"
            popoverTarget={MOBILE_NAV_ID}
            popoverTargetAction="hide"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3 rounded-md bg-muted p-3">
            <IconBox className="size-5" aria-hidden />
            <span>
              <span className="block text-sm font-semibold">{APP_CONTEXT.name}</span>
              <span className="block text-xs text-muted-foreground">
                {APP_CONTEXT.code} · {APP_CONTEXT.environment}
              </span>
            </span>
          </div>
        </div>
        <nav aria-label="Mobile prototype" className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item, index) => (
            <Link
              key={`${item.label}-mobile-${index}`}
              to={item.to}
              onClick={closeMobileNavigation}
              activeProps={
                item.label === "Applications"
                  ? undefined
                  : ({ "data-active": "true" } as Record<string, string>)
              }
              className={cn(
                "rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                "data-[active=true]:bg-brand-tint data-[active=true]:text-brand-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main id="codex-main-content" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}

function closeMobileNavigation() {
  document.getElementById(MOBILE_NAV_ID)?.hidePopover();
}
