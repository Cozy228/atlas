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

const KIND_CONFIG: Record<UpdateKind, { label: string; dotClass: string; textClass: string }> = {
  new: { label: "New", dotClass: "bg-success", textClass: "text-success-ink" },
  updated: { label: "Updated", dotClass: "bg-info", textClass: "text-info-ink" },
  policy: { label: "Policy", dotClass: "bg-warning", textClass: "text-warning-ink" },
  deprecated: {
    label: "Deprecated",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
};

/**
 * Changelog timeline: a date-stamped feed (no card wrapper). Each entry carries a
 * same-colour plate so the coordinate grid shows only in the gaps between entries.
 */
export function PlatformUpdates() {
  return (
    <ol className="flex flex-col gap-4">
      {UPDATES.map((update) => (
        <UpdateEntry key={update.title} update={update} />
      ))}
    </ol>
  );
}

function UpdateEntry({ update }: { update: PlatformUpdate }) {
  const config = KIND_CONFIG[update.kind];

  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-4 sm:grid-cols-[4.5rem_1fr]">
      <time
        dateTime={update.date}
        className="w-fit bg-background font-mono text-xs leading-5 tabular-nums text-muted-foreground"
      >
        {formatDate(update.date)}
      </time>
      <div className="w-fit max-w-[68ch] bg-background">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", config.dotClass)} />
            <span
              className={cn(
                "font-mono type-caption font-semibold uppercase tracking-[0.04em]",
                config.textClass,
              )}
            >
              {config.label}
            </span>
          </span>
          {update.href ? (
            <a
              href={update.href}
              className="type-detail font-semibold text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {update.title}
            </a>
          ) : (
            <span className="type-detail font-semibold text-foreground">{update.title}</span>
          )}
        </p>
        <p className="mt-1 text-xs leading-5 text-pretty text-muted-foreground">
          {update.description}
        </p>
      </div>
    </li>
  );
}
