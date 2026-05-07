import { Link, createFileRoute } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconBuildingFactory,
  IconCircleDashedCheck,
  IconMessage2,
  IconMessageReport,
  IconShieldCheck,
} from "@tabler/icons-react";
import type {
  Source,
  SourceDiscoveryResponse,
  Topic,
  TopicDiscoveryResponse,
} from "@atlas/schema";

import {
  fetchSourceDiscovery,
  fetchTopicDiscovery,
} from "@/api/server/contextApi";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";
import { classifyFreshness } from "@/lib/evidence";
import { cn } from "@/lib/utils";

type HomeLoaderData = {
  topics: ReadonlyArray<Topic>;
  sources: ReadonlyArray<Source>;
  signals: {
    capabilityCount: number;
    landingZoneCount: number;
    sourceCount: number;
    staleSourceCount: number;
    deprecatedSourceCount: number;
    restrictedSourceCount: number;
  };
};

export const Route = createFileRoute("/")({
  loader: async (): Promise<HomeLoaderData> => {
    const [topicsResp, sourcesResp]: [TopicDiscoveryResponse, SourceDiscoveryResponse] =
      await Promise.all([fetchTopicDiscovery(), fetchSourceDiscovery()]);

    return {
      topics: topicsResp.topics,
      sources: sourcesResp.sources,
      signals: {
        capabilityCount: topicsResp.topics.filter(
          (topic) => topic.topic_type === "capability",
        ).length,
        landingZoneCount: topicsResp.topics.filter(
          (topic) => topic.topic_type === "landing-zone",
        ).length,
        sourceCount: sourcesResp.sources.length,
        staleSourceCount: sourcesResp.sources.filter(
          (source) => classifyFreshness(source) !== "current",
        ).length,
        deprecatedSourceCount: sourcesResp.sources.filter(
          (source) => source.authority_level === "deprecated",
        ).length,
        restrictedSourceCount: sourcesResp.sources.filter(
          (source) => source.visibility === "restricted",
        ).length,
      },
    };
  },
  component: HomeRoute,
});

type Entry = {
  to: string;
  label: string;
  description: string;
  count: number;
  icon: typeof IconCircleDashedCheck;
};

function HomeRoute() {
  const { signals } = Route.useLoaderData();

  const entries: Entry[] = [
    {
      to: "/capabilities",
      label: "Find a capability",
      description:
        "Approved cloud platform capabilities with owners, support paths, and authoritative module evidence.",
      count: signals.capabilityCount,
      icon: IconCircleDashedCheck,
    },
    {
      to: "/landing-zones",
      label: "Choose a landing zone",
      description:
        "Compare environments, guardrails, and provisioning entry tools across landing zones.",
      count: signals.landingZoneCount,
      icon: IconBuildingFactory,
    },
    {
      to: "/sources",
      label: "Look up a source",
      description:
        "Discover authoritative source owners, anchors, freshness, and warning state.",
      count: signals.sourceCount,
      icon: IconShieldCheck,
    },
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow="Atlas Portal"
        title="Pick the right cloud platform context, fast"
        description="Atlas governs cloud capabilities, landing zones, and authoritative sources so application teams stop guessing which document, module, or owner is current."
        actions={
          <Link
            to="/ask"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconMessage2 className="size-4 text-muted-foreground" />
            Ask Atlas
            <Badge variant="outline" className="border-border">
              Deferred
            </Badge>
          </Link>
        }
      />

      <PageSection
        title="Start a task"
        description="Three primary entries cover the V1 pilot. Counts come from the live Context API."
      >
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={entry.to}>
              <PrimaryEntryLink entry={entry} />
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="Today's signals"
        description="Live counts from the Context API source discovery response."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SignalRow
            label="Stale or due-for-review sources"
            value={signals.staleSourceCount}
            hint="Sources at or past their review_frequency window."
            tone={signals.staleSourceCount > 0 ? "warning" : "neutral"}
          />
          <SignalRow
            label="Deprecated sources still mapped"
            value={signals.deprecatedSourceCount}
            hint="Sources marked authority_level=deprecated still in the registry."
            tone={signals.deprecatedSourceCount > 0 ? "critical" : "neutral"}
          />
          <SignalRow
            label="Restricted sources"
            value={signals.restrictedSourceCount}
            hint="Visible as restricted metadata; content fetch returns access_denied."
            tone={signals.restrictedSourceCount > 0 ? "warning" : "neutral"}
          />
        </div>
      </PageSection>

      <PageSection title="Help Atlas stay accurate">
        <Link
          to="/sources"
          className={cn(
            "flex flex-col gap-1 rounded-md border border-border bg-card p-4 text-sm transition-colors",
            "hover:border-border hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="flex items-center gap-2 text-foreground">
            <IconMessageReport className="size-4 text-muted-foreground" />
            Report missing, stale, broken, or unclear guidance
          </span>
          <span className="text-xs text-muted-foreground">
            Feedback is inline on capability, landing zone, and source detail
            pages. Use the source lookup to find the right target.
          </span>
        </Link>
      </PageSection>
    </PageBody>
  );
}

function PrimaryEntryLink({ entry }: { entry: Entry }) {
  const Icon = entry.icon;
  return (
    <Link
      to={entry.to}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors",
        "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {entry.label}
        </span>
        <IconArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {entry.description}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-foreground">{entry.count}</span>{" "}
        registered
      </p>
    </Link>
  );
}

function SignalRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "warning" | "critical";
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: "text-foreground",
    warning: "text-warning-foreground",
    critical: "text-critical",
  };
  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums tracking-tight",
          toneClass[tone],
        )}
      >
        {value}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
    </article>
  );
}
