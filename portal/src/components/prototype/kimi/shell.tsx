/**
 * Prototype "kimi" — dedicated shell.
 *
 * The prototype is an independent interpretation of the Atlas product
 * experience, so it opts out of the portal shell (see routes/__root.tsx) and
 * renders its own: a compact top bar with the prototype nav, the application
 * context switcher (URL-driven, shared across all prototype routes), and a
 * persistent honesty chip marking fixture data and simulated actions.
 */

import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { IconChevronDown, IconCompass, IconDatabase } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import type { AppId, AtlasApp } from "./fixtures";
import { APPS, APP_MAP, CURRENT_USER } from "./fixtures";
import { Mono } from "./ui";

const NAV_ITEMS = [
  { to: "/prototype/kimi/dashboard", label: "Dashboard" },
  { to: "/prototype/kimi/onboarding", label: "Onboarding" },
  { to: "/prototype/kimi/scaffolder", label: "Scaffolder" },
  { to: "/prototype/kimi/diagnosis", label: "Diagnosis" },
] as const;

/** Current application context, driven by the `?app=` search param. */
export function usePrototypeApp(): {
  appId: AppId;
  app: AtlasApp;
  setApp: (next: AppId) => void;
} {
  const { app: appId } = useSearch({ from: "/prototype/kimi", strict: true });
  const navigate = useNavigate();
  const setApp = (next: AppId) => {
    // Switching application resets surface-specific params (stage, run).
    void navigate({ to: ".", search: { app: next } });
  };
  return { appId, app: APP_MAP[appId], setApp };
}

export function PrototypeShell({ children }: { children: ReactNode }) {
  const { appId } = usePrototypeApp();
  // The prototype ships a light scheme only. Strip the portal's dark class
  // while mounted so scoped tokens render as designed; restore on exit.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    if (hadDark) root.classList.remove("dark");
    return () => {
      if (hadDark) root.classList.add("dark");
    };
  }, []);

  return (
    <div className="pv flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <Link
            to="/prototype/kimi/dashboard"
            search={{ app: appId }}
            aria-label="Atlas prototype home"
            className="flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-6 items-center justify-center rounded-[4px] bg-primary text-primary-foreground">
              <IconCompass size={15} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="text-sm font-bold tracking-[-0.02em] text-foreground">Atlas</span>
            <span className="hidden rounded-[2px] border border-border px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.04em] text-muted-foreground sm:inline">
              prototype · kimi
            </span>
          </Link>

          <nav aria-label="Prototype" className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={{ app: appId }}
                activeProps={{ "data-active": "true" }}
                className={cn(
                  "rounded-sm px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors",
                  "hover:bg-secondary hover:text-foreground",
                  "data-[active=true]:font-semibold data-[active=true]:text-foreground data-[active=true]:shadow-[inset_0_-2px_0_var(--color-primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-[2px] border border-warning/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.03em] text-warning-ink uppercase lg:inline-flex"
              title="All data is fictional fixture content. Actions are simulated locally; nothing leaves the browser."
            >
              <IconDatabase size={11} strokeWidth={2} aria-hidden />
              Fixture data · simulated actions
            </span>
            <AppSwitcher />
            <span
              className="hidden text-xs text-muted-foreground xl:inline"
              title={`${CURRENT_USER.name}, ${CURRENT_USER.role}`}
            >
              {CURRENT_USER.name}
            </span>
          </div>
        </div>

        {/* Mobile nav: second row, horizontally scrollable. */}
        <nav
          aria-label="Prototype"
          className="flex items-center gap-0.5 overflow-x-auto border-t border-border px-3 py-1.5 md:hidden"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              search={{ app: appId }}
              activeProps={{ "data-active": "true" }}
              className={cn(
                "shrink-0 rounded-sm px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground",
                "data-[active=true]:font-semibold data-[active=true]:text-foreground data-[active=true]:shadow-[inset_0_-2px_0_var(--color-primary)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 sm:px-6">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <p className="text-[11px] text-muted-foreground">
            Independent design exploration by model <Mono>kimi</Mono>. Fictional applications,
            people and systems. Actions are simulated in the browser; nothing is sent anywhere.
          </p>
          <Link
            to="/"
            className="text-[11px] font-medium text-brand-ink underline-offset-3 hover:underline"
          >
            Exit to Cloud DevEx Portal
          </Link>
        </div>
      </footer>
    </div>
  );
}

function AppSwitcher() {
  const { appId, setApp } = usePrototypeApp();
  return (
    <label
      className={cn(
        "relative flex h-8 items-center gap-1.5 rounded-md border border-border bg-card pl-2.5 text-sm font-medium text-foreground",
        "transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring",
      )}
    >
      <span className="hidden font-mono text-[10px] tracking-[0.04em] text-muted-foreground uppercase sm:inline">
        App
      </span>
      <select
        aria-label="Current application"
        value={appId}
        onChange={(event) => setApp(event.target.value as AppId)}
        className="h-full w-[8.5rem] appearance-none truncate bg-transparent pr-7 outline-none sm:w-auto sm:max-w-[22ch]"
      >
        {APPS.map((app) => (
          <option key={app.id} value={app.id}>
            {app.name} · {app.code}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        strokeWidth={2}
        className="pointer-events-none absolute right-2.5 text-muted-foreground"
        aria-hidden
      />
    </label>
  );
}
