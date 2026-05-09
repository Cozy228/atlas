import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { AskAtlasFab } from "@/components/ask-atlas-fab";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  children: ReactNode;
};

type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
};

const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  { to: "/", label: "Home", exact: true },
  { to: "/explore", label: "Availability" },
  { to: "/capabilities", label: "Capabilities" },
  { to: "/landing-zones", label: "Landing Zones" },
  { to: "/sources", label: "Sources" },
  { to: "/ask", label: "Ask Atlas" },
];

export function PortalShell({ children }: PortalShellProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background text-foreground">
      <TopBar />
      <main className="min-w-0 flex-1">{children}</main>
      <AskAtlasFab />
    </div>
  );
}

function TopBar() {
  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-40 flex h-[52px] items-center gap-1 border-b border-border px-4 sm:px-8",
        "bg-background/85 backdrop-blur-md backdrop-saturate-150",
      )}
    >
      <BrandLink />
      <nav
        aria-label="Primary"
        className="hidden items-center gap-0.5 md:flex"
      >
        {PRIMARY_NAV.map((item) => (
          <TopNavLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <HealthIndicator />
        <SyncPill />
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
          "font-mono text-[11px] font-bold leading-none tracking-[-0.04em] text-primary-foreground",
        )}
      >
        A
      </span>
      <span className="text-[15px] font-bold tracking-[-0.03em] text-foreground">
        Atlas
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
        "rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "data-[active=true]:bg-brand-tint data-[active=true]:font-semibold data-[active=true]:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {item.label}
    </Link>
  );
}

function HealthIndicator() {
  return (
    <span
      aria-label="Atlas Context API status: live"
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-2.5 py-1 sm:inline-flex",
        "transition-colors hover:bg-muted",
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
        <span className="relative size-1.5 rounded-full bg-success" />
      </span>
      <span className="text-[11px] font-semibold text-muted-foreground">
        Live
      </span>
    </span>
  );
}

function SyncPill() {
  return (
    <span
      className={cn(
        "hidden items-center rounded-full border border-border bg-card px-2 py-0.5 lg:inline-flex",
        "font-mono text-[10px] font-medium text-muted-foreground",
      )}
    >
      Synced just now
    </span>
  );
}
