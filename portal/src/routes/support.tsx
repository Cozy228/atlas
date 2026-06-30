/**
 * Reach a team · route `/support`
 * ===================================================================
 * When the portal can't answer, find the human who can — fast. The centre of the
 * page is a directory of the platform's owning teams (the fictional {@link TEAMS}
 * list), each with what it covers and its contact channels shown directly (email ·
 * chat), each one-click copyable. How the portal answers (evidence rules) sits
 * underneath as context.
 *
 * Data: the teams + contact channels are a fictional, public-safe directory
 * defined inline; the footer grounding counts come from the live catalog/sources.
 */
import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconMail,
  IconMessages,
  IconScale,
  IconUsers,
  IconWorldOff,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { ResourceCatalogResponse, SourceDiscoveryResponse } from "@atlas/schema";

import { resourceCatalogQueryOptions, sourceDiscoveryQueryOptions } from "@/api/queries";
import { cn } from "@/lib/utils";

/**
 * One owning team's directory entry. Everything a row shows lives here, so adding
 * a team is one object: a name, what it covers, and its contact methods.
 *  - `email` → a real `mailto:` link, copyable.
 *  - `chat`  → the chat channel handle (Teams has no deep link), copyable.
 */
type Team = {
  name: string;
  covers: string;
  email: string;
  chat: string;
};

/**
 * The platform's owning teams — a small, fictional, public-safe directory. The
 * derived resources carry no owner (honest gap), so the support page names the
 * teams directly. To add a team, add an entry below.
 */
const TEAMS: ReadonlyArray<Team> = [
  {
    name: "Cloud Platform",
    covers: "Compute, storage, networking, and the approved Terraform module library.",
    email: "cloud-platform@clouddevex.example",
    chat: "#cloud-platform",
  },
  {
    name: "Security & Identity",
    covers: "Security policies, IAM permission boundaries, and access reviews.",
    email: "security@clouddevex.example",
    chat: "#security",
  },
  {
    name: "Data Platform",
    covers: "Databases, analytics, and streaming services.",
    email: "data-platform@clouddevex.example",
    chat: "#data-platform",
  },
  {
    name: "Integration & Messaging",
    covers: "API Gateway, eventing, and message queues.",
    email: "integration@clouddevex.example",
    chat: "#integration",
  },
  {
    name: "Developer Experience",
    covers: "This portal, the guidance journeys, and new-application onboarding.",
    email: "devex@clouddevex.example",
    chat: "#developer-experience",
  },
  {
    name: "Reliability Engineering",
    covers: "Regional availability, incident response, and on-call.",
    email: "reliability@clouddevex.example",
    chat: "#reliability",
  },
];

export const Route = createFileRoute("/support")({
  loader: async ({ context }) => {
    const [catalogResp, sourcesResp] = await Promise.all([
      context.queryClient.ensureQueryData(
        resourceCatalogQueryOptions,
      ) as Promise<ResourceCatalogResponse>,
      context.queryClient.ensureQueryData(
        sourceDiscoveryQueryOptions,
      ) as Promise<SourceDiscoveryResponse>,
    ]);
    const resources = catalogResp.resources;
    return {
      serviceCount: resources.filter((resource) => resource.kind === "service").length,
      policyCount: resources.filter((resource) => resource.kind === "guardrail").length,
      sourceCount: sourcesResp.sources.length,
    };
  },
  component: SupportRoute,
});

const RULES: ReadonlyArray<{ icon: Icon; title: string; copy: string }> = [
  {
    icon: IconScale,
    title: "Evidence first",
    copy: "Claims without a registered citation are blocked, not paraphrased.",
  },
  {
    icon: IconWorldOff,
    title: "Registry only",
    copy: "Answers draw on cited platform context. No web retrieval.",
  },
  {
    icon: IconUsers,
    title: "Humans in the loop",
    copy: "Every answer names its sources and where they came from; escalation is one click.",
  },
];

function SupportRoute() {
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-12 sm:px-8">
      <header className="flex flex-col gap-2.5">
        <span className="w-fit font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Reach a team
        </span>
        <h1 className="w-fit max-w-[22ch] text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
          Find the team that owns it
        </h1>
        <p className="w-fit max-w-[58ch] text-[14px] leading-[1.55] text-muted-foreground">
          The portal answers most questions with citations — when you need a human, here&rsquo;s who
          owns each part of the platform and how to reach them.
        </p>
      </header>

      <section aria-label="Owning teams">
        <ul className="grid gap-x-8 gap-y-6 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEAMS.map((team) => (
            <TeamCell key={team.name} team={team} />
          ))}
        </ul>
      </section>

      <section
        aria-label="How the portal answers"
        className="flex flex-col gap-4 border-t border-border pt-6"
      >
        <h2 className="w-fit font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          How the portal answers
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {RULES.map((rule) => {
            const RuleIcon = rule.icon;
            return (
              <div key={rule.title} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <RuleIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-[13px] font-bold text-foreground">{rule.title}</span>
                </span>
                <p className="w-fit text-[12.5px] leading-[1.5] text-muted-foreground">
                  {rule.copy}
                </p>
              </div>
            );
          })}
        </div>
        <GroundingLine data={data} />
      </section>
    </div>
  );
}

function TeamCell({ team }: { team: Team }) {
  return (
    <li className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
          {team.name}
        </span>
        <span className="text-[12.5px] leading-[1.5] text-muted-foreground">{team.covers}</span>
      </div>
      {/* Contacts are the payload of this page, so show them outright — stacked,
          full value visible, each one-click copyable (and email is a mailto). */}
      <div className="flex flex-col gap-1.5">
        <ContactChip icon={IconMail} value={team.email} href={`mailto:${team.email}`} />
        <ContactChip icon={IconMessages} value={team.chat} suffix="Teams" />
      </div>
    </li>
  );
}

function ContactChip({
  icon: ContactIcon,
  value,
  href,
  suffix,
}: {
  icon: Icon;
  value: string;
  href?: string;
  suffix?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="group/contact inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <ContactIcon aria-hidden className="size-3.5 shrink-0" />
      {href ? (
        <a
          href={href}
          className="font-mono text-foreground transition-colors hover:text-brand-ink hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="font-mono text-foreground">{value}</span>
      )}
      {suffix ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${value}`}
        title={copied ? "Copied" : "Copy"}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] transition-colors",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          "opacity-0 group-hover/contact:opacity-100 focus-visible:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {copied ? (
          <IconCheck aria-hidden className="size-3.5 text-success" />
        ) : (
          <IconCopy aria-hidden className="size-3.5" />
        )}
      </button>
    </div>
  );
}

/** One inline line of live coverage facts — what the assistant can see. */
function GroundingLine({
  data,
}: {
  data: {
    serviceCount: number;
    policyCount: number;
    sourceCount: number;
  };
}) {
  const facts: ReadonlyArray<{ value: number; label: string }> = [
    { value: data.serviceCount, label: "services" },
    { value: data.policyCount, label: "security policies" },
    { value: data.sourceCount, label: "sources" },
  ];
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-4 text-[12px] text-muted-foreground">
      <span>Cloud DevEx Portal is grounded in</span>
      {facts.map((fact, i) => (
        <span key={fact.label} className="whitespace-nowrap">
          {i > 0 ? (
            <span aria-hidden className="mr-2 text-border-strong">
              ·
            </span>
          ) : null}
          <span className="font-bold tabular-nums text-foreground">{fact.value}</span> {fact.label}
        </span>
      ))}
      <Link
        to="/sources"
        className="ml-1 inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline"
      >
        Browse the registry
        <IconArrowRight aria-hidden className="size-3.5" />
      </Link>
    </p>
  );
}
