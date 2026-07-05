/**
 * Internal graph-layer types (Step 2). These are derivation-cache shapes —
 * per-root snapshots and their parse outputs — NOT an API boundary, so they stay
 * plain TypeScript (like `CachedResponse`), never Zod. The wire-facing shapes
 * (`GraphVersion`, `ChangeEvent`, …) live in `@atlas/schema`.
 *
 * A "root" is one INDEPENDENTLY-FAILING source (M2/M10): the availability page
 * per landing zone (`availability:<lzId>`), the TFE module probe set
 * (`terraform`), and the guardrail Confluence space (`security`). Killing one
 * root ages exactly one subgraph (acceptance B); the plural-from-line-one shape
 * (availability is per-LZ) is P26/P29, not a later migration.
 *
 * A snapshot holds ONLY the descriptive, graph-facing facts (P18/P24): which
 * services are available where, which modules a service uses at what version,
 * which guardrails exist. Source content bodies are never snapshotted — they
 * stay live-fetched at read time.
 */

/** The availability root for ONE landing zone (`availability:<lzId>`): which
 *  services the zone offers (any non-absent location) + their presentation. */
export type AvailabilityRootParse = {
  kind: "availability";
  landingZoneId: string;
  landingZoneName: string;
  services: { slug: string; name: string; domain: string }[];
};

/** The TFE module probe set (`terraform`): every service→module binding found
 *  across the probe set, each with the module's published version (if any). */
export type TerraformRootParse = {
  kind: "terraform";
  modules: { serviceSlug: string; address: string; name: string; version?: string }[];
};

/**
 * The guardrail Confluence space (`security`): the discovered policy catalog and
 * — when discovery witnesses the linkage — which services each guardrail
 * governs. `governedBy` is optional/empty today: the list-only crawl yields the
 * catalog, not the service linkage, so `governed-by` edges stay honestly empty
 * until an adapter witnesses them (the closed edge set is ready regardless).
 */
export type SecurityRootParse = {
  kind: "security";
  guardrails: { slug: string; name: string }[];
  governedBy?: { serviceSlug: string; guardrailSlug: string }[];
};

/** The descriptive parse output of one source root. */
export type RootParse = AvailabilityRootParse | TerraformRootParse | SecurityRootParse;

/**
 * One root's snapshot: its parse output + the real parse clock (`resolvedAt` —
 * provenance, NEVER a staleness clock: staleness is recomputed at read time,
 * ADR-0013 §6) + the parse-contract version (P16: a shape the parser no longer
 * recognizes is red CI, not a silent empty).
 */
export type RootSnapshot = {
  rootId: string;
  parse: RootParse;
  resolvedAt: string;
  contractVersion: string;
};

/**
 * The K=2 retention per root: `confirmed` is the last-confirmed baseline (the
 * differ's "from"); `pending` is the last successful observation (the damping
 * candidate). A delta becomes an event only when it appears in `pending` AND
 * persists into the next parse (M6 stability damping) — current + previous,
 * nothing more (that history is what `events` is for).
 */
export type SnapshotPair = {
  confirmed?: RootSnapshot;
  pending?: RootSnapshot;
};

/**
 * A degradation annotation (decision 8): a root failed its refresh, so its
 * last-good snapshot is served with its `resolvedAt` unchanged and a loud note.
 * A degradation gap emits ZERO events + exactly one aging note — the feed never
 * lies during recovery (M6/unified §3.4 honesty rule).
 */
export type AgingNote = {
  rootId: string;
  resolvedAt: string;
  message: string;
};
