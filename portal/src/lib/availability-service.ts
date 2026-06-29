import type { Topic } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";

const TOPIC_SERVICE_ALIASES: Readonly<Record<string, string>> = {
  "aws-bedrock": "bedrock",
  "aws-textract": "textract",
  "serverless-compute": "lambda",
};

/**
 * Map a service Topic to its canonical Resource route params
 * (`/service/$provider/$id`, plan 020 15d). The slug tail is the availability
 * service id (`serverless-compute` → `lambda`, the Topic↔Resource Decompose of
 * plan 020 15a); every catalog service in the seed is AWS-provided.
 */
export function serviceRouteParamsForTopic(topic: Pick<Topic, "id">): {
  provider: string;
  id: string;
} {
  return { provider: "aws", id: TOPIC_SERVICE_ALIASES[topic.id] ?? topic.id.replace(/^aws-/, "") };
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
  return TOPIC_SERVICE_ALIASES[topic.id] ?? topic.id.replace(/^aws-/, "");
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(aws|amazon)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
