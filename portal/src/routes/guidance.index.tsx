import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { GuidanceTypeBadge } from "@/components/guidance/shared";
import { PageBody, PageHeader } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { guidanceByFamily, listGuidance, type Guidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guidance/")({
  component: GuidanceIndexRoute,
});

function GuidanceIndexRoute() {
  const groups = guidanceByFamily();
  const total = listGuidance().length;

  return (
    <PageBody width="comfortable">
      <PageHeader
        eyebrow="Process"
        title="Guidance"
        badge={
          <Badge variant="outline" className="font-mono type-caption">
            {total} routes
          </Badge>
        }
        description="Pick a scenario route through the platform. Each guidance is a vertical stepper with the tasks, sources, and support paths for every step — orientation, not automation."
      />

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map(({ family, items }) => (
            <section key={family.id} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {family.label}
                </span>
                <p className="type-detail text-muted-foreground">{family.description}</p>
              </div>
              <ul
                className="grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
              >
                {items.map((guidance) => (
                  <li key={guidance.id}>
                    <GuidanceCard guidance={guidance} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageBody>
  );
}

function GuidanceCard({ guidance }: { guidance: Guidance }) {
  return (
    <Link
      to="/guidance/$guidanceId"
      params={{ guidanceId: guidance.id }}
      className={cn(
        "group flex h-full flex-col gap-3.5 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 type-body font-bold tracking-[-0.01em] text-foreground">
          {guidance.title}
          <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusFlag status={guidance.status} />
          <GuidanceTypeBadge type={guidance.type} />
        </div>
      </div>

      <p className="line-clamp-3 type-detail leading-5 text-muted-foreground">
        {guidance.objective}
      </p>

      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
        <Meta label="Destination" value={guidance.destination.title} />
        <Meta label="Steps" value={`${guidance.steps.length}`} mono />
        <Meta label="Owner" value={guidance.owner.team} />
        <Meta label="Reviewed" value={guidance.lastReviewed} mono />
      </dl>
    </Link>
  );
}

function StatusFlag({ status }: { status: Guidance["status"] }) {
  if (status === "published") return null;
  const variant = status === "deprecated" ? "critical" : "warning";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-xs text-foreground", mono && "font-mono")}>{value}</dd>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 type-detail text-muted-foreground">
      <p className="font-bold text-foreground">No guidance routes published.</p>
      <p className="mt-1 leading-6">Author a guidance definition to populate this board.</p>
    </div>
  );
}
