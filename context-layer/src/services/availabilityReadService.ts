import type { AvailabilityReadResponse } from "@atlas/schema";

import type { ContextService } from "./contextService";
import { isStale } from "./freshness";

const AVAILABILITY_SOURCE_ID = "availability-matrix";

export class AvailabilitySourceNotFoundError extends Error {
  constructor() {
    super("The availability matrix source is not registered.");
    this.name = "AvailabilitySourceNotFoundError";
  }
}

/** Read the single cited availability projection shared by HTTP and MCP. */
export async function readAvailability(service: ContextService): Promise<AvailabilityReadResponse> {
  const source = service.registry.sources.getById(AVAILABILITY_SOURCE_ID);
  if (!source) {
    throw new AvailabilitySourceNotFoundError();
  }

  const warnings: AvailabilityReadResponse["warnings"] = [];
  if (source.visibility === "restricted") {
    warnings.push({
      code: "restricted_source",
      message: "Source exists but has restricted visibility.",
      source_id: source.id,
    });
  }
  if (isStale(source, service.now)) {
    warnings.push({
      code: "stale_source",
      message: "Source is past its review frequency.",
      source_id: source.id,
    });
  }

  return {
    zones: await service.availabilityProvider.getZones(),
    citation: {
      source_id: source.id,
      label: source.title,
      location: source.location,
    },
    warnings,
  };
}
