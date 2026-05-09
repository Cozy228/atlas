import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

type JourneyStep = {
  num: string;
  title: string;
  description: string;
  links: ReadonlyArray<JourneyLink>;
};

type JourneyLink = {
  label: string;
  to: "/explore" | "/capabilities" | "/landing-zones" | "/sources";
};

const STEPS: ReadonlyArray<JourneyStep> = [
  {
    num: "01 Get started",
    title: "Understand the catalog",
    description:
      "Browse available capabilities, service domains, and regional availability before committing.",
    links: [
      { label: "Service catalog", to: "/capabilities" },
      { label: "Availability map", to: "/explore" },
    ],
  },
  {
    num: "02 Build",
    title: "Provision and configure",
    description:
      "Use approved Terraform modules and Harness pipelines to provision landing zones and services.",
    links: [{ label: "Landing zones", to: "/landing-zones" }],
  },
  {
    num: "03 Validate",
    title: "Check guardrails",
    description:
      "Review applicable guardrails before deploy. Authoritative source citations are inline on each surface.",
    links: [{ label: "Sources", to: "/sources" }],
  },
  {
    num: "04 Operate",
    title: "Monitor and evolve",
    description:
      "Track availability changes across regions and stay current with the platform catalog.",
    links: [{ label: "Availability map", to: "/explore" }],
  },
];

export function JourneyGrid() {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2",
      )}
    >
      {STEPS.map((step) => (
        <Step key={step.num} step={step} />
      ))}
    </div>
  );
}

function Step({ step }: { step: JourneyStep }) {
  return (
    <article className="flex flex-col gap-2 bg-card p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {step.num}
      </p>
      <h3 className="text-[14px] font-bold tracking-[-0.01em] text-foreground">
        {step.title}
      </h3>
      <p className="text-[12px] leading-5 text-muted-foreground">
        {step.description}
      </p>
      {step.links.length > 0 ? (
        <ul className="mt-1.5 flex flex-col">
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

function JourneyLinkItem({
  label,
  to,
}: {
  label: ReactNode;
  to: JourneyLink["to"];
}) {
  return (
    <Link
      to={to}
      className={cn(
        "py-0.5 text-[12px] font-semibold text-primary transition-colors",
        "hover:text-[color:var(--accent-hover,theme(colors.primary.DEFAULT))]",
        "hover:underline underline-offset-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
      )}
    >
      {label}
    </Link>
  );
}
