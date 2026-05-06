import { Link, createFileRoute } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconBuildingFactory,
  IconCircleDashedCheck,
  IconMessage2,
  IconMessageReport,
  IconShieldCheck,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

type Entry = {
  to: string;
  label: string;
  description: string;
  icon: typeof IconCircleDashedCheck;
  // Phase P3 will populate counts and signals from real Context API loaders.
  // Today we keep the entry static so we never invent source truth.
  loaderHint?: string;
};

const PRIMARY_ENTRIES: Entry[] = [
  {
    to: "/capabilities",
    label: "Find a capability",
    description:
      "Approved cloud platform capabilities with owners, support paths, and authoritative module evidence.",
    icon: IconCircleDashedCheck,
    loaderHint: "Counts and review signals load from /topics?topic_type=capability",
  },
  {
    to: "/landing-zones",
    label: "Choose a landing zone",
    description:
      "Compare environments, guardrails, and provisioning entry tools across landing zones.",
    icon: IconBuildingFactory,
    loaderHint: "Loads from /topics?topic_type=landing-zone",
  },
  {
    to: "/sources",
    label: "Look up a source",
    description:
      "Discover authoritative source owners, anchors, freshness, and warning state.",
    icon: IconShieldCheck,
    loaderHint: "Loads from /sources",
  },
];

function HomeRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Atlas Portal"
        title="Pick the right cloud platform context, fast"
        description="Atlas governs cloud capabilities, landing zones, and authoritative sources so application teams stop guessing which document, module, or owner is current."
        actions={
          <>
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
          </>
        }
      />

      <PageSection
        title="Start a task"
        description="Three primary entries cover the V1 pilot. Browse first, then drill into evidence."
      >
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {PRIMARY_ENTRIES.map((entry) => (
            <li key={entry.to}>
              <PrimaryEntryLink entry={entry} />
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="Today's signals"
        description="Loader-backed in Phase P3. Until then we surface the contract, not invented numbers."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: "Stale review backlog",
              hint: "Topics whose authoritative source is past review_frequency.",
            },
            {
              label: "Broken anchors",
              hint: "Anchors marked broken, weak, or unvalidated by the registry.",
            },
            {
              label: "Authority conflicts",
              hint: "Topics with overlapping authoritative sources to reconcile.",
            },
          ].map((signal) => (
            <article
              key={signal.label}
              className="flex flex-col gap-2 rounded-md border border-border bg-card p-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {signal.label}
              </p>
              <p className="text-sm text-foreground">
                Awaiting Phase P3 loader.
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {signal.hint}
              </p>
            </article>
          ))}
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
            Feedback is inline on capability, landing zone, source, and Ask
            surfaces. Use the source lookup to find the right target.
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
      {entry.loaderHint ? (
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/80">
          {entry.loaderHint}
        </p>
      ) : null}
    </Link>
  );
}
