/**
 * ResourceReferenceDiscovery (plan 017 decision #1, ADR-0016) — a NEW narrow
 * port that discovers the Confluence pages documenting a service and returns
 * them as reference-only document links. It is NOT the governed Registry and NOT
 * `SourceContentProvider`: a discovered reference means the agent learns a page
 * EXISTS, never that its body was obtained. The strict governed `SourceSchema`
 * stays untouched and reference-unaware.
 *
 * The port consumes only a normalized `ServiceIdentity` (decision #3) and returns
 * the references plus an explicit cache/freshness state (decision #5, B12) so a
 * consumer never mistakes an empty list for a healthy "no docs" answer:
 *   - `status: "unavailable"` — past max-staleness, cache dead (not unbounded stale);
 *   - `incomplete: true`      — recall was truncated at the per-service cap.
 *
 * Dev wires `createDevReferenceDiscovery()` (in-code fixture); a prod build swaps
 * in `createConfluenceReferenceDiscovery(config)` (live CQL search). Core stays
 * adapter-free — only the composition root picks the implementation.
 */
import type { DiscoveredReference, ReferenceDiscoveryState, ServiceIdentity } from "@atlas/schema";

export type ResourceReferenceDiscoveryResult = ReferenceDiscoveryState & {
  references: DiscoveredReference[];
};

export type ResourceReferenceDiscovery = {
  discover(identity: ServiceIdentity): Promise<ResourceReferenceDiscoveryResult>;
};
