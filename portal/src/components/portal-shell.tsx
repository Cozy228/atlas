import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconBuildingFactory,
  IconChartCircles,
  IconCircleDashedCheck,
  IconHome,
  IconMessage2,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";

import { AtlasLogo } from "@/components/atlas-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  children: ReactNode;
};

type NavItem = {
  to: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  trailing?: ReactNode;
  exact?: boolean;
};

const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  {
    to: "/",
    label: "Home",
    description: "Dashboard and signals",
    icon: IconHome,
    exact: true,
  },
  {
    to: "/capabilities",
    label: "Capabilities",
    description: "Approved platform capabilities",
    icon: IconCircleDashedCheck,
  },
  {
    to: "/landing-zones",
    label: "Landing Zones",
    description: "Environments and guardrails",
    icon: IconBuildingFactory,
  },
  {
    to: "/sources",
    label: "Sources",
    description: "Authoritative source lookup",
    icon: IconShieldCheck,
  },
];

const SECONDARY_NAV: ReadonlyArray<NavItem> = [
  {
    to: "/ask",
    label: "Ask Atlas",
    description: "Cited answers (deferred)",
    icon: IconMessage2,
    trailing: (
      <Badge variant="outline" className="border-border text-muted-foreground">
        Deferred
      </Badge>
    ),
  },
];

export function PortalShell({ children }: PortalShellProps) {
  return (
    <div className="grid min-h-dvh w-full grid-cols-[18rem_minmax(0,1fr)] bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside
      aria-label="Atlas Portal navigation"
      className="sticky top-0 z-10 flex h-dvh flex-col gap-6 border-r border-sidebar-border bg-sidebar px-4 py-6 text-sidebar-foreground"
    >
      <div className="flex items-center justify-between">
        <Link
          to="/"
          aria-label="Atlas Portal home"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AtlasLogo variant="wordmark" />
        </Link>
        <Badge variant="outline">Pilot</Badge>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <SidebarNavLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="flex flex-col gap-1">
        <p className="px-2 text-xs font-medium uppercase tracking-[0.12em] text-sidebar-muted-foreground">
          Consumers
        </p>
        <nav aria-label="Secondary" className="flex flex-col gap-1">
          {SECONDARY_NAV.map((item) => (
            <SidebarNavLink key={item.to} item={item} />
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-2 rounded-md border border-sidebar-border bg-sidebar-muted p-3 text-xs leading-5 text-sidebar-muted-foreground">
        <p className="font-semibold text-sidebar-foreground">
          Source-native by design
        </p>
        <p>
          Atlas Portal cites the source registry. It does not mirror, edit, or
          replace source content.
        </p>
      </div>
    </aside>
  );
}

function SidebarNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.exact ?? false }}
      activeProps={{ "data-active": "true" } as Record<string, string>}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors",
        "hover:bg-sidebar-muted",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Icon className="size-4 text-sidebar-muted-foreground group-data-[active=true]:text-sidebar-accent-foreground" />
      <span className="flex flex-1 flex-col">
        <span>{item.label}</span>
        <span className="text-[11px] font-normal leading-4 text-sidebar-muted-foreground">
          {item.description}
        </span>
      </span>
      {item.trailing ?? null}
    </Link>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-sm">
      <label className="flex h-9 flex-1 items-center gap-2 rounded-md border border-border bg-card pl-3 pr-2 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
        <IconSearch className="size-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search topics, sources, or owners"
          className="h-full w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Search topics, sources, or owners"
        />
        <kbd className="hidden h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium uppercase text-muted-foreground sm:inline-flex">
          /
        </kbd>
      </label>
      <div className="hidden items-center gap-3 lg:flex">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <IconChartCircles className="size-3.5" />
          Atlas Context API
        </span>
        <Badge variant="info">env: pilot</Badge>
      </div>
    </header>
  );
}
