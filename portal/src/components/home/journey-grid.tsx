import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type JourneyStep = {
  phase: string;
  title: string;
  description: string;
  links: ReadonlyArray<JourneyLink>;
};

type JourneyLink = {
  label: string;
  to: "/availability" | "/catalog" | "/guidance" | "/sources";
};

const STEPS: ReadonlyArray<JourneyStep> = [
  {
    phase: "Get started",
    title: "Understand the catalog",
    description:
      "Browse available services, service domains, and regional availability before committing.",
    links: [
      { label: "Service catalog", to: "/catalog" },
      { label: "Availability map", to: "/availability" },
    ],
  },
  {
    phase: "Build",
    title: "Provision and configure",
    description:
      "Use approved Terraform modules and Harness pipelines to provision landing zones and services.",
    links: [{ label: "Guidance", to: "/guidance" }],
  },
  {
    phase: "Validate",
    title: "Check guardrails",
    description:
      "Review applicable guardrails before deploy. Authoritative source citations are inline on each surface.",
    links: [{ label: "Sources", to: "/sources" }],
  },
  {
    phase: "Operate",
    title: "Monitor and evolve",
    description:
      "Track availability changes across regions and stay current with the platform catalog.",
    links: [{ label: "Availability map", to: "/availability" }],
  },
];

export function JourneyGrid() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-stretch">
      {STEPS.map((step, index) => (
        <JourneyStep
          key={step.phase}
          step={step}
          index={index}
          isFirst={index === 0}
          isLast={index === STEPS.length - 1}
        />
      ))}
    </div>
  );
}

function JourneyStep({
  step,
  index,
  isFirst,
  isLast,
}: {
  step: JourneyStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const ordinal = String(index + 1).padStart(2, "0");

  return (
    <article
      className={cn(
        "flex flex-1 flex-col py-5 sm:py-0 sm:px-6",
        isFirst && "sm:pl-0",
        isLast && "sm:pr-0",
        !isFirst && "border-t border-border sm:border-t-0 sm:border-l",
      )}
    >
      {/* Ghost ordinal — sequence anchor, deliberately subordinate */}
      <span
        aria-hidden
        className="mb-4 block select-none font-mono type-ordinal font-semibold leading-none tracking-[-0.04em] tabular-nums text-border-strong sm:mb-5"
      >
        {ordinal}
      </span>

      {/* Phase label — the "where you are in the journey" signal */}
      <span className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-primary">
        {step.phase}
      </span>

      <h3 className="mb-2 type-body font-semibold leading-[1.35] tracking-[-0.01em] text-foreground">
        {step.title}
      </h3>

      <p className="mb-4 type-detail leading-[1.7] text-muted-foreground">{step.description}</p>

      {step.links.length > 0 ? (
        <ul className="mt-auto flex flex-col gap-1.5">
          {step.links.map((link) => (
            <li key={link.to + link.label}>
              <JourneyLinkItem label={link.label} to={link.to} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function JourneyLinkItem({ label, to }: { label: ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
        "text-xs font-semibold",
        "bg-brand-tint text-primary",
        "transition-colors duration-150",
        "hover:bg-primary hover:text-primary-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {label}
      <IconArrowRight className="size-3 shrink-0" />
    </Link>
  );
}
