import type { Topic } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";

const TOPIC_SERVICE_ALIASES: Readonly<Record<string, string>> = {
  "aws-bedrock": "bedrock",
  "aws-textract": "textract",
  "serverless-compute": "lambda",
};

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

function resolveServiceId(topic: Pick<Topic, "id" | "name">): string {
  return TOPIC_SERVICE_ALIASES[topic.id] ?? topic.id.replace(/^aws-/, "");
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(aws|amazon)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
