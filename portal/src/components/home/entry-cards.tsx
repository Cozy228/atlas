import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconArrowsExchange, IconRocket, IconSearch } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import { cn } from "@/lib/utils";

type EntryCardsProps = {
  capabilities: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
};

type LaunchCard = {
  icon: Icon;
  title: string;
  description: string;
  /** Direct quick-links — pre-rendered so TanStack typed routes stay checked. */
  links: ReadonlyArray<ReactNode>;
};

const linkClass = cn(
  "group/link inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-brand-ink",
  "transition-colors hover:underline",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

function LinkArrow() {
  return (
    <IconArrowRight
      aria-hidden
      className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5"
    />
  );
}

/**
 * Home entry points: three launchpad cards. Each is a labelled card with a small
 * icon, a one-line framing question, and direct quick-links that route straight
 * to the catalog / availability / guidance surfaces — no click-to-expand panel.
 */
export function EntryCards({ capabilities, landingZones }: EntryCardsProps) {
  const cards: ReadonlyArray<LaunchCard> = [
    {
      icon: IconSearch,
      title: "Find a service",
      description: "Which approved capability fits your use case?",
      links: [
        <Link key="caps" to="/catalog" search={{ tab: "capabilities" }} className={linkClass}>
          Browse {capabilities.length} capabilities
          <LinkArrow />
        </Link>,
        <Link key="avail" to="/availability" className={linkClass}>
          Check regional availability
          <LinkArrow />
        </Link>,
      ],
    },
    {
      icon: IconArrowsExchange,
      title: "Migrate an app",
      description: "Find the target environment and the platform team for your move.",
      links: [
        <Link key="zones" to="/catalog" search={{ tab: "landing-zones" }} className={linkClass}>
          Compare {landingZones.length} landing zones
          <LinkArrow />
        </Link>,
        <Link key="guidance" to="/guidance" className={linkClass}>
          Read migration guidance
          <LinkArrow />
        </Link>,
      ],
    },
    {
      icon: IconRocket,
      title: "Onboard a new app",
      description: "Landing zones, provisioning tools, and support contacts.",
      links: [
        <Link key="zone" to="/catalog" search={{ tab: "landing-zones" }} className={linkClass}>
          Choose a landing zone
          <LinkArrow />
        </Link>,
        <Link key="onboard" to="/guidance" className={linkClass}>
          Browse onboarding guidance
          <LinkArrow />
        </Link>,
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {cards.map((card) => (
        <LaunchCardView key={card.title} card={card} />
      ))}
    </div>
  );
}

function LaunchCardView({ card }: { card: LaunchCard }) {
  const { icon: CardIcon, title, description, links } = card;
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5",
        "transition-[border-color] duration-150 hover:border-border-strong",
        // Brand corner ticks (DESIGN.md §06 capability card).
        "before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-[7px] before:border-t before:border-l before:border-brand before:opacity-50 before:content-['']",
        "after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-[7px] after:border-r after:border-b after:border-brand after:opacity-50 after:content-['']",
      )}
    >
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-md bg-brand-tint text-brand-ink"
      >
        <CardIcon className="size-[18px]" stroke={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="type-body font-bold tracking-[-0.01em] text-foreground">{title}</h3>
        <p className="text-sm leading-[1.5] text-pretty text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto flex flex-col items-start gap-1.5 border-t border-border pt-3">
        {links}
      </div>
    </div>
  );
}
