import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconMenu2, IconMessageCircle } from "@tabler/icons-react";

import { AskAtlasFab } from "@/components/ask-atlas-fab";
import { AskAtlasProvider, useAskAtlas } from "@/components/ask-atlas/context";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeProvider } from "@/lib/theme";
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
  { to: "/capabilities", label: "Capabilities" },
  { to: "/landing-zones", label: "Landing Zones" },
  { to: "/explore", label: "Availability" },
  { to: "/sources", label: "Sources" },
];

export function PortalShell({ children }: PortalShellProps) {
  return (
    <ThemeProvider>
      <AskAtlasProvider>
        <div className="flex min-h-dvh w-full flex-col bg-background text-foreground">
          <TopBar />
          <main className="min-w-0 flex-1">{children}</main>
          <AskAtlasFab />
        </div>
      </AskAtlasProvider>
    </ThemeProvider>
  );
}

function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-40 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border px-4 sm:px-8",
        "bg-background/85 backdrop-blur-sm",
      )}
    >
      <BrandLink />
      <nav aria-label="Primary" className="hidden items-center justify-center gap-0.5 md:flex">
        {PRIMARY_NAV.map((item) => (
          <TopNavLink key={item.to} item={item} />
        ))}
      </nav>
      <div className="flex items-center justify-end gap-2">
        <NavMenu open={menuOpen} onOpenChange={(open) => setMenuOpen(open)} />
        <InlineAskButton />
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
          "font-mono text-[11px] font-bold leading-none tracking-[-0.04em] text-primary-foreground",
        )}
      >
        A
      </span>
      <span className="text-[15px] font-bold tracking-[-0.03em] text-foreground">Atlas</span>
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
        "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "data-[active=true]:bg-brand-tint data-[active=true]:font-semibold data-[active=true]:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {item.label}
    </Link>
  );
}

function InlineAskButton() {
  const { openAsk } = useAskAtlas();
  return (
    <button
      type="button"
      aria-label="Open Ask Atlas"
      onClick={openAsk}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground lg:hidden",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <IconMessageCircle size={15} strokeWidth={2} aria-hidden />
      <span className="sr-only">Ask Atlas</span>
    </button>
  );
}

type NavMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function NavMenu({ open, onOpenChange }: NavMenuProps) {
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
            <SheetTitle className="text-[14px] font-bold tracking-[-0.03em]">Atlas</SheetTitle>
          </SheetHeader>
          <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
            {PRIMARY_NAV.map((item) => (
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
