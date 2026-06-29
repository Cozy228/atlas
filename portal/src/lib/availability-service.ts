import type { ResourceRecordResponse } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";

/**
 * Map a service Resource to its canonical detail-route params
 * (`/service/$provider/$id`, plan 020 15d). A service resource `slug` is
 * `{provider}/{id}` (e.g. `aws/textract`), so the params are a straight split on
 * "/": `provider` is the cloud, `id` the service machine id. A bare slug (no "/")
 * degrades to the AWS provider.
 */
export function serviceRouteParamsForResource(resource: Pick<ResourceRecordResponse, "slug">): {
  provider: string;
  id: string;
} {
  const [provider, id] = resource.slug.split("/");
  return id ? { provider, id } : { provider: "aws", id: provider };
}

/** Resolve a service Resource to its availability record by canonical service id
 *  (the resource slug tail, e.g. `aws/textract` → `textract`), with a name match
 *  as a fallback. */
export function findAvailabilityServiceForResource(
  resource: Pick<ResourceRecordResponse, "slug" | "name">,
  services: ReadonlyArray<AvailabilityRecord>,
): AvailabilityRecord | null {
  const serviceId = resource.slug.split("/").at(-1) ?? resource.slug;

  return (
    services.find((service) => service.id === serviceId) ??
    services.find((service) => normalizeName(service.name) === normalizeName(resource.name)) ??
    null
  );
}

/** Direct lookup by canonical availability service id (the resource slug tail).
 *  Used by the resource-first detail page (plan 020 15d), which already holds the
 *  exact `{provider}/{id}` slug and needs no name fuzzy match. */
export function findAvailabilityServiceById(
  services: ReadonlyArray<AvailabilityRecord>,
  id: string,
): AvailabilityRecord | null {
  return services.find((service) => service.id === id) ?? null;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(aws|amazon)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
