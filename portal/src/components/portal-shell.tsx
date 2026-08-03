import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconMenu2, IconSearch, IconX } from "@tabler/icons-react";

import logoSvg from "@/assets/logo.svg?url";
import type { DataMode } from "@/api/portalContracts";
import { AskAtlasFab } from "@/components/ask-atlas-fab";
import { AskAtlasProvider, useAskAtlas } from "@/components/ask-atlas/context";
import { CurrentLandingZoneProvider } from "@/components/landing-zone/context";
import { LandingZoneSelector } from "@/components/landing-zone/landing-zone-selector";
import { PortalFooter } from "@/components/portal-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ThemeProvider } from "@/lib/theme";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  children: ReactNode;
  /** Dev-runtime data mode (plan 026 WU-B); drives the "Mock data" top-nav badge.
   *  Undefined / 'live' renders no badge — the prod build always reports 'live'. */
  dataMode?: DataMode;
};

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
};

const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  { to: "/", label: "Home", exact: true },
  { to: "/availability", label: "Availability" },
  { to: "/catalog", label: "Catalog" },
  { to: "/guidance", label: "Guidance" },
  { to: "/sources", label: "Sources" },
  { to: "/whatsnew", label: "Newsletter" },
  { to: "/support", label: "Support" },
];

const MOBILE_NAV_ID = "mobile-navigation";

export function PortalShell({ children, dataMode }: PortalShellProps) {
  return (
    <ThemeProvider>
      <CurrentLandingZoneProvider>
        <AskAtlasProvider>
          <div className="flex min-h-dvh w-full flex-col bg-background text-foreground">
            <TopBar dataMode={dataMode} />
            {/* 32px coordinate grid on a full-width canvas, beginning below the
              opaque top bar. Shows only in negative space; text-bearing blocks
              carry bg-background plates to mask it (DESIGN.md §5). */}
            <main className="min-w-0 flex-1 bg-coordinate-grid">{children}</main>
            <PortalFooter />
            <AskAtlasFab />
          </div>
        </AskAtlasProvider>
      </CurrentLandingZoneProvider>
    </ThemeProvider>
  );
}

function TopBar({ dataMode }: { dataMode?: DataMode }) {
  const nav = PRIMARY_NAV;

  return (
    <header
      className={cn(
        // 56px, sticky, opaque (the grid starts cleanly below it). DESIGN.md §4.
        "sticky top-0 z-40 grid h-14 grid-cols-[auto_1fr] items-center gap-2 border-b border-border px-4 sm:px-8 md:grid-cols-[1fr_auto_1fr]",
        "bg-background",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <BrandLink />
      </div>
      <nav aria-label="Primary" className="hidden items-center justify-center gap-1 md:flex">
        {nav.map((item) => (
          <TopNavLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="flex items-center justify-end gap-1.5">
        {dataMode === "mock" ? (
          <Badge
            variant="warning"
            data-testid="data-mode-badge"
            title="Serving deterministic mock fixtures — not live source systems"
          >
            <span className="sm:hidden">Mock</span>
            <span className="hidden sm:inline">Mock data</span>
          </Badge>
        ) : null}
        <NavMenu />
        <LandingZoneSelector />
        <SearchButton />
        <ThemeToggle />
      </div>
    </header>
  );
}

function BrandLink() {
  return (
    <Link
      to="/"
      aria-label="Cloud DevEx Portal home"
      className={cn(
        "mr-1 flex shrink-0 items-center gap-2.5 rounded-md py-1 pr-1 sm:mr-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <img src={logoSvg} alt="" aria-hidden className="size-6 shrink-0" />
      {/* Divider between the mark and the wordmark — set them a little apart. */}
      <span aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />
      <span className="type-body hidden font-bold tracking-[-0.03em] text-foreground sm:inline">
        Cloud DevEx Portal
      </span>
    </Link>
  );
}

function TopNavLink({ item }: { item: NavItem }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      activeProps={{ "data-active": "true" } as Record<string, string>}
      className={cn(
        // Active = brand underline (no tinted pill). DESIGN.md §4 "Top nav / Tabs".
        "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
        "data-[active=true]:rounded-b-none data-[active=true]:font-semibold data-[active=true]:text-foreground",
        "data-[active=true]:shadow-[inset_0_-2px_0_var(--color-brand)] data-[active=true]:hover:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {item.label}
    </Link>
  );
}

function SearchButton() {
  const { openOverlay } = useAskAtlas();
  return (
    <button
      type="button"
      aria-label="Search the catalog"
      onClick={() => openOverlay("search")}
      className={cn(
        "hidden size-8 items-center justify-center rounded-sm text-muted-foreground sm:flex",
        "transition-colors hover:bg-secondary hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconSearch size={17} strokeWidth={2} aria-hidden />
      <span className="sr-only">Search</span>
    </button>
  );
}

function NavMenu() {
  const nav = PRIMARY_NAV;
  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        popoverTarget={MOBILE_NAV_ID}
        popoverTargetAction="show"
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-muted-foreground md:hidden",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconMenu2 size={15} strokeWidth={2} aria-hidden />
        <span className="sr-only">Navigation</span>
      </button>
      <div
        id={MOBILE_NAV_ID}
        popover="auto"
        role="dialog"
        aria-label="Mobile navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 m-0 h-dvh w-3/4 max-w-56 border-0 border-r border-border bg-popover p-0 text-popover-foreground shadow-lg",
          "backdrop:bg-overlay/10 backdrop:backdrop-blur-xs",
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-bold tracking-[-0.03em]">Cloud DevEx Portal</span>
          <button
            type="button"
            aria-label="Close navigation menu"
            popoverTarget={MOBILE_NAV_ID}
            popoverTargetAction="hide"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX size={16} aria-hidden />
          </button>
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
          {nav.map((item) => (
            <SheetNavLink key={item.to} item={item} onNavigate={closeMobileNavigation} />
          ))}
        </nav>
      </div>
    </>
  );
}

function closeMobileNavigation() {
  document.getElementById(MOBILE_NAV_ID)?.hidePopover();
}

function SheetNavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      activeProps={{ "data-active": "true" } as Record<string, string>}
      onClick={onNavigate}
      className={cn(
        "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "data-[active=true]:bg-brand-tint data-[active=true]:font-semibold data-[active=true]:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {item.label}
    </Link>
  );
}
