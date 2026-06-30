import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconMenu2, IconSearch } from "@tabler/icons-react";

import type { DataMode } from "@/api/server/dataMode";
import { AskAtlasFab } from "@/components/ask-atlas-fab";
import { AskAtlasProvider, useAskAtlas } from "@/components/ask-atlas/context";
import { CurrentLandingZoneProvider } from "@/components/landing-zone/context";
import { LandingZoneSelector } from "@/components/landing-zone/landing-zone-selector";
import { PortalFooter } from "@/components/portal-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = PRIMARY_NAV;

  return (
    <header
      className={cn(
        // 56px, sticky, opaque (the grid starts cleanly below it). DESIGN.md §4.
        "sticky top-0 z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-4 sm:px-8",
        "bg-background",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <BrandLink />
        {dataMode === "mock" ? (
          <Badge
            variant="warning"
            data-testid="data-mode-badge"
            title="Serving deterministic mock fixtures — not live source systems"
          >
            Mock data
          </Badge>
        ) : null}
      </div>
      <nav aria-label="Primary" className="hidden items-center justify-center gap-1 md:flex">
        {nav.map((item) => (
          <TopNavLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="flex items-center justify-end gap-1.5">
        <NavMenu open={menuOpen} onOpenChange={(open) => setMenuOpen(open)} />
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
      aria-label="Atlas Portal home"
      className={cn(
        "mr-5 flex shrink-0 items-center gap-2 rounded-md py-1 pr-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 items-center justify-center rounded-[7px] bg-primary",
          "font-mono text-xs font-bold leading-none tracking-[-0.04em] text-primary-foreground",
        )}
      >
        A
      </span>
      <span className="type-body font-bold tracking-[-0.03em] text-foreground">Atlas</span>
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
      aria-label="Search Atlas catalog"
      onClick={() => openOverlay("search")}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm text-muted-foreground",
        "transition-colors hover:bg-secondary hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconSearch size={17} strokeWidth={2} aria-hidden />
      <span className="sr-only">Search</span>
    </button>
  );
}

type NavMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function NavMenu({ open, onOpenChange }: NavMenuProps) {
  const nav = PRIMARY_NAV;
  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
        className={cn(
          "flex size-7 items-center justify-center rounded-md text-muted-foreground md:hidden",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconMenu2 size={15} strokeWidth={2} aria-hidden />
        <span className="sr-only">Navigation</span>
      </button>
      <Sheet open={open} onOpenChange={(o) => onOpenChange(o)}>
        <SheetContent side="left" className="data-[side=left]:sm:max-w-56 gap-0 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm font-bold tracking-[-0.03em]">Atlas</SheetTitle>
          </SheetHeader>
          <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
            {nav.map((item) => (
              <SheetNavLink key={item.to} item={item} onNavigate={() => onOpenChange(false)} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
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
