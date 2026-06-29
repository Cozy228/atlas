import type { Topic } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";

/**
 * Map a service Topic to its canonical Resource route params
 * (`/service/$provider/$id`, plan 020 15d). Post-flip (plan 018 G5) the service
 * Topic id IS the resource slug (`aws/<id>`, e.g. `aws/textract`), so the route
 * params are a straight split on "/": `provider` is the cloud, `id` the service
 * machine id. A bare id (no "/") degrades to the AWS provider.
 */
export function serviceRouteParamsForTopic(topic: Pick<Topic, "id">): {
  provider: string;
  id: string;
} {
  const [provider, id] = topic.id.split("/");
  return id ? { provider, id } : { provider: "aws", id: provider };
}

export function findAvailabilityServiceForTopic(
  topic: Pick<Topic, "id" | "name">,
  services: ReadonlyArray<AvailabilityRecord>,
): AvailabilityRecord | null {
  const serviceId = resolveServiceId(topic);

  return (
    services.find((service) => service.id === serviceId) ??
    services.find((service) => normalizeName(service.name) === normalizeName(topic.name)) ??
    null
  );
}

/** Direct lookup by canonical availability service id (the resource slug tail).
 *  Used by the resource-first detail page (plan 020 15d), which already holds the
 *  exact `{provider}/{id}` slug and needs no topic-name fuzzy match. */
export function findAvailabilityServiceById(
  services: ReadonlyArray<AvailabilityRecord>,
  id: string,
): AvailabilityRecord | null {
  return services.find((service) => service.id === id) ?? null;
}

function resolveServiceId(topic: Pick<Topic, "id" | "name">): string {
  // The resource slug tail is the availability service id (`aws/textract` →
  // `textract`); a bare id (no "/") is already the service id.
  const tail = topic.id.split("/").at(-1);
  return tail ?? topic.id;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(aws|amazon)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
