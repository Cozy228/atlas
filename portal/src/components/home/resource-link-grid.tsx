import { Link } from "@tanstack/react-router";
import {
  IconBuildingFactory2,
  IconFolderOpen,
  IconShieldCheck,
  IconWorld,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type ResourceLink = {
  to: "/catalog" | "/guidance" | "/availability" | "/sources";
  title: string;
  description: string;
  icon: typeof IconWorld;
};

const RESOURCES: ReadonlyArray<ResourceLink> = [
  {
    to: "/catalog",
    title: "Browse by domain",
    description: "Filter services by compute, storage, database, AI, or integration.",
    icon: IconFolderOpen,
  },
  {
    to: "/guidance",
    title: "Compare environments",
    description: "Match your workload's requirements to the right landing zone.",
    icon: IconBuildingFactory2,
  },
  {
    to: "/availability",
    title: "Check regional coverage",
    description: "See which services are available in US-East-1, GDC, DC16, and more.",
    icon: IconWorld,
  },
  {
    to: "/sources",
    title: "Review authoritative sources",
    description: "Inspect authority level, review freshness, and broken-anchor status.",
    icon: IconShieldCheck,
  },
];

export function ResourceLinkGrid() {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {RESOURCES.map((resource) => (
        <li key={resource.to}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}

function ResourceCard({ resource }: { resource: ResourceLink }) {
  const Icon = resource.icon;
  return (
    <Link
      to={resource.to}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition-[border-color,box-shadow,transform]",
        "hover:border-border-strong hover:shadow-sm",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background",
        )}
      >
        <Icon className="size-4 text-muted-foreground" />
      </span>
      <span className="flex flex-col">
        <span className="type-detail font-bold text-foreground">{resource.title}</span>
        <span className="text-xs leading-5 text-muted-foreground">{resource.description}</span>
      </span>
    </Link>
  );
}
