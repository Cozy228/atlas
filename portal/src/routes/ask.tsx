/**
 * Reach a team · route `/ask`
 * ===================================================================
 * The reference behind the Ask Atlas overlay, reframed around its real job:
 * when Atlas can't answer, find the human who can — fast. The CENTRE of the
 * page is a support directory split BY DOMAIN, each domain showing its owning
 * team and a few ways to reach them (email · Teams · ServiceNow). A filter sits
 * on top; how Ask Atlas behaves (evidence rules) sits underneath as context.
 * The overlay's "Owning teams →" footer link lands here.
 *
 * Data: real topic + source discovery projections; the contact channels are
 * fictional, public-safe mock derived from the owning team name.
 */
import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconMail,
  IconMessages,
  IconScale,
  IconSearch,
  IconTicket,
  IconUsers,
  IconWorldOff,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { SourceDiscoveryResponse, TopicDiscoveryResponse } from "@atlas/schema";

import { sourceDiscoveryQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import { cn } from "@/lib/utils";

type Domain = { domain: string; team: string; channel: string; areas: number };

export const Route = createFileRoute("/ask")({
  loader: async ({ context }) => {
    const [topicsResp, sourcesResp] = await Promise.all([
      context.queryClient.ensureQueryData(
        topicDiscoveryQueryOptions,
      ) as Promise<TopicDiscoveryResponse>,
      context.queryClient.ensureQueryData(
        sourceDiscoveryQueryOptions,
      ) as Promise<SourceDiscoveryResponse>,
    ]);
    const topics = topicsResp.topics;
    // One row per domain (topic category) → the team that owns it + area count.
    const map = new Map<string, Domain>();
    for (const topic of topics) {
      const entry = map.get(topic.category) ?? {
        domain: topic.category,
        team: topic.owner_team,
        channel: topic.support_channel,
        areas: 0,
      };
      entry.areas += 1;
      map.set(topic.category, entry);
    }
    const domains = [...map.values()].toSorted((a, b) => a.domain.localeCompare(b.domain));
    return {
      domains,
      serviceCount: topics.filter((topic) => topic.topic_type === "service").length,
      landingZoneCount: topics.filter((topic) => topic.topic_type === "landing-zone").length,
      guardrailCount: topics.filter((topic) => topic.topic_type === "guardrail-area").length,
      sourceCount: sourcesResp.sources.length,
      authoritativeCount: sourcesResp.sources.filter(
        (source) => source.authority_level === "authoritative",
      ).length,
    };
  },
  component: AskTeamsRoute,
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
    copy: "Every answer names its sources' stewards; escalation is one click.",
  },
];

function AskTeamsRoute() {
  const data = Route.useLoaderData();
  const [query, setQuery] = useState("");

  const domains = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.domains;
    return data.domains.filter(
      (d) =>
        d.domain.toLowerCase().includes(q) ||
        d.team.toLowerCase().includes(q) ||
        d.channel.toLowerCase().includes(q),
    );
  }, [data.domains, query]);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-12 sm:px-8">
      <header className="flex flex-col gap-2.5">
        <span className="w-fit bg-background font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Reach a team
        </span>
        <h1 className="w-fit max-w-[22ch] bg-background text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-foreground">
          Find the team that owns it
        </h1>
        <p className="w-fit max-w-[58ch] bg-background text-[14px] leading-[1.55] text-muted-foreground">
          Ask Atlas answers most questions with citations — when you need a human, here&rsquo;s who
          owns each part of the platform and how to reach them.
        </p>
      </header>

      <section aria-label="Owning teams by domain" className="flex flex-col gap-4">
        <label className="flex items-center gap-2.5 rounded-[5px] border border-border-strong bg-card px-3.5 py-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
          <IconSearch aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by domain, team, or channel…"
            className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {domains.length}
          </span>
        </label>

        {domains.length === 0 ? (
          <p className="border-t border-border py-6 text-center text-[13px] text-muted-foreground">
            No domain matches “{query}”. Try “network”, “identity”, or “storage”.
          </p>
        ) : (
          <ul className="grid gap-x-8 gap-y-6 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {domains.map((domain) => (
              <DomainCell key={domain.domain} domain={domain} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label="How Ask Atlas behaves"
        className="flex flex-col gap-4 border-t border-border pt-6"
      >
        <h2 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          How Ask Atlas behaves
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {RULES.map((rule) => {
            const RuleIcon = rule.icon;
            return (
              <div key={rule.title} className="flex flex-col gap-1.5">
                <span className="flex items-center gap-2">
                  <RuleIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="bg-background text-[13px] font-bold text-foreground">
                    {rule.title}
                  </span>
                </span>
                <p className="w-fit bg-background text-[12.5px] leading-[1.5] text-muted-foreground">
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

function DomainCell({ domain }: { domain: Domain }) {
  const email = `${domain.team}@atlas.example`;
  return (
    <li className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {domain.domain}
        </span>
        <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-foreground">
          {domain.team}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {domain.channel} · {domain.areas} {domain.areas === 1 ? "area" : "areas"}
        </span>
      </div>
      {/* Contacts collapse to icons; each expands its label on hover. */}
      <div className="flex items-center gap-3">
        <Contact icon={IconMail} label={email} href={`mailto:${email}`} />
        <Contact icon={IconMessages} label="Teams chat" />
        <Contact icon={IconTicket} label="ServiceNow ticket" />
      </div>
    </li>
  );
}

function Contact({ icon: ContactIcon, label, href }: { icon: Icon; label: string; href?: string }) {
  const className = cn(
    "group/c inline-flex items-center text-muted-foreground",
    href ? "transition-colors hover:text-brand-ink" : "hover:text-foreground",
  );
  const content = (
    <>
      <ContactIcon aria-hidden className="size-4 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap font-mono text-[11px] transition-[max-width,padding] duration-200 group-hover/c:max-w-[200px] group-hover/c:pl-1.5">
        {label}
      </span>
    </>
  );
  return href ? (
    <a href={href} title={label} className={className}>
      {content}
    </a>
  ) : (
    <span title={label} className={className}>
      {content}
    </span>
  );
}

/** One inline line of live coverage facts — what the assistant can see. */
function GroundingLine({
  data,
}: {
  data: {
    serviceCount: number;
    landingZoneCount: number;
    guardrailCount: number;
    sourceCount: number;
    authoritativeCount: number;
  };
}) {
  const facts: ReadonlyArray<{ value: number; label: string }> = [
    { value: data.serviceCount, label: "services" },
    { value: data.landingZoneCount, label: "landing zones" },
    { value: data.guardrailCount, label: "guardrail areas" },
    { value: data.sourceCount, label: `sources (${data.authoritativeCount} authoritative)` },
  ];
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border pt-4 text-[12px] text-muted-foreground">
      <span>Atlas is grounded in</span>
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
