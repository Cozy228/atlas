/**
 * PROTOTYPE (production candidate) — Ask Atlas redesign · route `/proto/ask`
 * ==========================================================================
 * Brainstorm direction: "the reading room". One centered column, the
 * conversation is the room. The header states the contract in a single
 * GROUNDING LINE (live registry coverage, computed — what the assistant can
 * see), the real `AskAtlasChat` (server-side ask, cited answers) fills the
 * page, and accountability sits below the conversation as two quiet bands:
 * how it behaves (evidence rules) and where the humans are (owning teams +
 * channels). No side rail — context should not compete with the answer.
 *
 * References: Claude.ai (the conversation is the page), Perplexity
 * (citation-first answers), Glean (workplace grounding).
 *
 * Data: real topic + source discovery projections; the chat itself is the
 * production component, not a mock.
 */
import { Fragment } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight, IconScale, IconUsers, IconWorldOff } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { SourceDiscoveryResponse, TopicDiscoveryResponse } from "@atlas/schema";

import { sourceDiscoveryQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import { AskAtlasChat } from "@/components/ask/ask-atlas-chat";
import { ClientOnly } from "@/components/client-only";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/proto/ask")({
  loader: async ({ context }) => {
    const [topicsResp, sourcesResp] = await Promise.all([
      context.queryClient.ensureQueryData(topicDiscoveryQueryOptions) as Promise<TopicDiscoveryResponse>,
      context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions) as Promise<SourceDiscoveryResponse>,
    ]);
    const topics = topicsResp.topics;
    // Unique (team, channel) pairs: one team can run several support channels.
    const teams = [...new Map(
      topics.map((topic) => [
        `${topic.owner_team}|${topic.support_channel}`,
        { team: topic.owner_team, channel: topic.support_channel },
      ]),
    ).values()].toSorted((a, b) => a.team.localeCompare(b.team));
    return {
      capabilityCount: topics.filter((topic) => topic.topic_type === "capability").length,
      landingZoneCount: topics.filter((topic) => topic.topic_type === "landing-zone").length,
      guardrailCount: topics.filter((topic) => topic.topic_type === "guardrail-area").length,
      sourceCount: sourcesResp.sources.length,
      authoritativeCount: sourcesResp.sources.filter(
        (source) => source.authority_level === "authoritative",
      ).length,
      teams,
    };
  },
  component: ProtoAsk,
});

const SUGGESTIONS = [
  { category: "Capability", prompt: "Which storage service should a multi-region workload use?" },
  { category: "Availability", prompt: "Is Bedrock available in the DR outpost?" },
  { category: "Governance", prompt: "What approvals does a GDC deployment need?" },
  { category: "Onboarding", prompt: "How do I onboard a new application to the platform?" },
] as const;

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
    title: "Humans stay in the loop",
    copy: "Every answer names its sources' stewards; escalation is one click.",
  },
];

/* ========================================================================== *
 * Page — one centered column; the conversation is the room
 * ========================================================================== */

function ProtoAsk() {
  const data = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-6 py-12 sm:px-8">
      <header className="flex flex-col items-center gap-4 text-center">
        {/* pl matches the tracking: letter-spacing trails the last glyph, so a
            centered box otherwise renders its text visibly left of the axis. */}
        <span className="w-fit bg-background pl-[0.14em] font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ask Atlas
        </span>
        <h1 className="w-fit max-w-[22ch] bg-background text-[2rem] font-bold leading-[1.1] tracking-[-0.03em] text-balance text-foreground">
          Ask a question about the platform
        </h1>
        <p className="w-fit max-w-[52ch] bg-background text-[14px] leading-[1.55] text-pretty text-muted-foreground">
          Cited answers from the same registry the rest of this portal renders. If Atlas cannot
          back a claim, it says so instead of guessing.
        </p>
        <GroundingLine data={data} />
      </header>

      {/* The conversation — the real production chat component */}
      <ClientOnly fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
        <AskAtlasChat
          suggestions={SUGGESTIONS}
          className="min-h-[600px] overflow-hidden rounded-xl border border-border bg-card"
        />
      </ClientOnly>

      {/* Accountability, below the conversation: rules, then the humans. */}
      <section aria-label="How Ask Atlas behaves" className="border-t border-border pt-6">
        <div className="grid gap-6 sm:grid-cols-3">
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
      </section>

      <section aria-label="Ask a person instead">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="w-fit bg-background text-[15px] font-bold tracking-[-0.01em] text-foreground">
            Rather ask a person?
          </h2>
          <span className="bg-background text-[12.5px] text-muted-foreground">
            The teams behind the registry, and where to reach them.
          </span>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {data.teams.map((entry) => (
            <li
              key={`${entry.team}|${entry.channel}`}
              className="flex items-baseline justify-between gap-3 border-t border-border py-2"
            >
              <span className="truncate text-[12.5px] font-medium text-foreground">{entry.team}</span>
              <code className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {entry.channel}
              </code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * One inline line of live coverage facts — what the assistant can see —
 * instead of a stat rail competing with the conversation.
 */
function GroundingLine({
  data,
}: {
  data: {
    capabilityCount: number;
    landingZoneCount: number;
    guardrailCount: number;
    sourceCount: number;
    authoritativeCount: number;
  };
}) {
  const facts: ReadonlyArray<{ value: number; label: string }> = [
    { value: data.capabilityCount, label: "capabilities" },
    { value: data.landingZoneCount, label: "landing zones" },
    { value: data.guardrailCount, label: "guardrail areas" },
    { value: data.sourceCount, label: `sources (${data.authoritativeCount} authoritative)` },
  ];
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 bg-background text-[12.5px] text-muted-foreground">
      <span>Grounded in</span>
      {facts.map((fact, i) => (
        <Fragment key={fact.label}>
          {i > 0 ? <span aria-hidden className="text-border-strong">·</span> : null}
          <span className="whitespace-nowrap">
            <span className="font-bold tabular-nums text-foreground">{fact.value}</span>{" "}
            {fact.label}
          </span>
        </Fragment>
      ))}
      <Link
        to="/proto/sources"
        className="ml-1 inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline"
      >
        Browse the registry
        <IconArrowRight aria-hidden className="size-3.5" />
      </Link>
    </p>
  );
}
