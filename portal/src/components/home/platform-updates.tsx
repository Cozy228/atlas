import { cn } from "@/lib/utils";

type UpdateKind = "new" | "updated" | "deprecated" | "policy";

type PlatformUpdate = {
  kind: UpdateKind;
  title: string;
  description: string;
  date: string;
  href?: string;
};

// Static fixture — replace with changelog API once available.
// Dates are ISO strings; formatDate() renders a relative label.
const UPDATES: ReadonlyArray<PlatformUpdate> = [
  {
    kind: "new",
    title: "Object Storage (S3-Compatible)",
    description:
      "Added to the catalog. Available in US-East-1 and DC16; multipart upload, versioning, and lifecycle rules supported.",
    date: "2025-05-08",
  },
  {
    kind: "policy",
    title: "GDC Deployment Approval",
    description:
      "Two-step approval now required for all GDC landing zone deployments. Provisioning runbook updated.",
    date: "2025-05-06",
  },
  {
    kind: "updated",
    title: "Kubernetes Platform",
    description:
      "Authority source refreshed from platform CMDB. Level raised to L1; previously stale anchor resolved.",
    date: "2025-05-03",
  },
  {
    kind: "deprecated",
    title: "VMware vSphere Provisioning",
    description: "End-of-life July 31. Migrate to the Cloud VM capability before the deadline.",
    date: "2025-04-28",
  },
];

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const KIND_CONFIG: Record<UpdateKind, { label: string; tagClass: string }> = {
  new: {
    label: "NEW",
    tagClass: "bg-success/10 text-success",
  },
  updated: {
    label: "UPDATED",
    tagClass: "bg-info/10 text-info",
  },
  deprecated: {
    label: "DEPRECATED",
    tagClass: "bg-muted text-muted-foreground",
  },
  policy: {
    label: "POLICY",
    tagClass: "bg-warning/10 text-warning",
  },
};

export function PlatformUpdates() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {UPDATES.map((update, index) => (
        <UpdateRow key={update.title} update={update} divider={index > 0} />
      ))}
    </div>
  );
}

function UpdateRow({ update, divider }: { update: PlatformUpdate; divider: boolean }) {
  const config = KIND_CONFIG[update.kind];

  return (
    <article className={cn("px-4 py-3.5", divider && "border-t border-border")}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-px font-mono type-caption font-bold tracking-[0.04em]",
            config.tagClass,
          )}
        >
          {config.label}
        </span>
        <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          {update.href ? (
            <a
              href={update.href}
              className="truncate type-detail font-semibold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {update.title}
            </a>
          ) : (
            <span className="truncate type-detail font-semibold text-foreground">
              {update.title}
            </span>
          )}
          <time
            dateTime={update.date}
            className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground"
          >
            {formatDate(update.date)}
          </time>
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{update.description}</p>
    </article>
  );
}
