/**
 * Source-root identity (Step 2, M2/M10/P26). A root is one independently-failing
 * source; its id namespaces its snapshot key `discovery:<envHash>:<rootId>`.
 *
 * Availability is PER landing zone — never one singular root for all clouds
 * (P26/P29): killing `availability:awsf` ages only the AWS subgraph while
 * `availability:azure` stays live. The TFE probe set and the guardrail Confluence
 * space are each one root.
 */
import { LANDING_ZONES } from "../landingZones";

export const TERRAFORM_ROOT_ID = "terraform";
export const SECURITY_ROOT_ID = "security";

export function availabilityRootId(landingZoneId: string): string {
  return `availability:${landingZoneId}`;
}

/** The landing-zone id carried by an `availability:<lzId>` root, or null. */
export function landingZoneIdOfRoot(rootId: string): string | null {
  const prefix = "availability:";
  return rootId.startsWith(prefix) ? rootId.slice(prefix.length) : null;
}

/** Every source root for a discovery pass: one availability root per landing
 *  zone in the topology, plus the terraform + security singletons. Plural from
 *  the first line — no singular cloud/root survives (P26). */
export function enumerateRootIds(): string[] {
  return [
    ...LANDING_ZONES.map((zone) => availabilityRootId(zone.id)),
    TERRAFORM_ROOT_ID,
    SECURITY_ROOT_ID,
  ];
}
