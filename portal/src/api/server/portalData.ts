import {
  LANDING_ZONES,
  cachedResolutionContext,
  resolveReleaseNotes,
  type Announcement,
  type Release,
} from "@atlas/context-layer";
import type { AvailabilityResponse, LandingZone } from "@atlas/schema";

import type { ContextApiClient } from "../contextApiClient";
import type { DataMode } from "../portalContracts";

export type { DataMode } from "../portalContracts";

export function resolveDataMode(): DataMode {
  // Hard prod gate: a leaked development marker must never make production
  // claim that mock data is active.
  if (process.env.NODE_ENV === "production") return "live";
  return process.env.DEV_DATA_MODE === "mock" ? "mock" : "live";
}

export function loadPortalLandingZones(): LandingZone[] {
  return LANDING_ZONES.map((zone) => ({ ...zone }));
}

export async function loadPortalAnnouncements(): Promise<Announcement[]> {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  return result.ok ? result.announcements : [];
}

export async function loadPortalReleases(): Promise<Release[]> {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  return result.ok ? result.releases : [];
}

let availabilityInFlight: Promise<AvailabilityResponse> | undefined;

export async function loadPortalAvailability(
  client: Pick<ContextApiClient, "getAvailability">,
  options: { coalesce?: boolean } = {},
): Promise<AvailabilityResponse> {
  const coalesce = options.coalesce !== false;
  if (!coalesce) {
    const { zones } = await client.getAvailability();
    return { zones };
  }
  return (availabilityInFlight ??= client
    .getAvailability()
    .then(({ zones }) => {
      return { zones };
    })
    .finally(() => {
      availabilityInFlight = undefined;
    }));
}
