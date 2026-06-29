import { Link } from "@tanstack/react-router";
import type { ResourceRecordResponse } from "@atlas/schema";

import { serviceRouteParamsForResource } from "@/lib/availability-service";
import { cn } from "@/lib/utils";

type RelatedColumnProps = {
  title: string;
  resources: ReadonlyArray<ResourceRecordResponse>;
};

const ROW_CLASS = cn(
  "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors",
  "hover:bg-muted",
);

export function RelatedColumn({ title, resources }: RelatedColumnProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-mono type-caption font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {resources.map((resource) => (
          <li key={resource.id}>
            <RelatedRow resource={resource} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Each related resource links to its own surface by kind: a security policy
 *  (guardrail) → `/policies`, a service → its canonical resource address. */
function RelatedRow({ resource }: { resource: ResourceRecordResponse }) {
  const body = (
    <>
      <span className="text-xs font-semibold text-foreground">{resource.name}</span>
      <span className="font-mono type-caption text-muted-foreground">{resource.owner_team}</span>
    </>
  );
  if (resource.kind === "guardrail") {
    return (
      <Link to="/policies/$policyId" params={{ policyId: resource.slug }} className={ROW_CLASS}>
        {body}
      </Link>
    );
  }
  return (
    <Link
      to="/service/$provider/$id"
      params={serviceRouteParamsForResource(resource)}
      className={ROW_CLASS}
    >
      {body}
    </Link>
  );
}
