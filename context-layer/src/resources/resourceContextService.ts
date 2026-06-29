import {
  sectionIds,
  type ContextSection,
  type MissingSection,
  type ResourceCitation,
  type ResourceContextResponse,
  type ResourceKind,
  type ResourceContextRecord,
  type ResourceRecordResponse,
  type ResourceSearchResponse,
  type ResourceSectionBinding,
  type ResourceSummary,
  type ResourceWarning,
  type SectionStatus,
  type ServiceIdentity,
} from "@atlas/schema";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import type { ResourceReferenceDiscovery } from "../services/resourceReferenceDiscovery";
import {
  applyOverlayAliases,
  normalizeServiceIdentity,
} from "../services/serviceIdentityNormalizer";
import type { ResolverRegistry } from "../resolvers/resolverRegistry";
import { defaultResolutionContext, type ResolutionContext } from "../resolvers/resolverTypes";
import type { SourceContentProvider } from "../resolvers/sourceContentProvider";
import { isStale } from "../services/freshness";
import { getResourceKindDef } from "./resourceKindRegistry";

/**
 * Live resource projection (ADR-0013). The agent-facing resource surface is a
 * projection of external Sources, not a stored document: each request loads a
 * resource's Section Projection Plan, live-resolves the referenced Sources via
 * the SAME resolver registry the Context bundle uses, and aggregates successes
 * by Section. Failures never fall back to a previously resolved excerpt.
 *
 * Two orthogonal axes (proposal §5.6): a Section carries a resolution `status`
 * (available / partial / unresolved) and a list of `warnings` whose codes are
 * drawn from `@atlas/schema` `warningCodes` — never a parallel status word.
 */

/**
 * The slice of a ContextService the projection facade needs. Declared
 * structurally so this module does not import the service (and cannot form an
 * import cycle); `ContextService` satisfies it.
 */
export type ResourceContextDeps = {
  resources: ResourceContextRecord[];
  /**
   * The service spine (plan 017 B4). For `kind: service` the availability
   * inventory — not `resources.yaml` — establishes Resource existence + canonical
   * identity, so a service with no governed overlay still renders.
   */
  availabilityProvider: Pick<AvailabilityProvider, "listServices">;
  /** Reference-only discovery port (plan 017 B4). Optional: absent → empty
   *  `references` + `null` discovery state (never fabricated links). */
  referenceDiscovery?: ResourceReferenceDiscovery;
  registry: {
    sources: { getById(id: string): import("@atlas/schema").Source | undefined };
  };
  resolvers: ResolverRegistry;
  contentProvider: SourceContentProvider;
  now: Date;
};

const KNOWN_SECTION_IDS = new Set<string>(sectionIds);

/** Thrown for a request the caller got wrong (HTTP maps this to 400 invalid_request). */
export class InvalidResourceRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResourceRequestError";
  }
}

export type SearchResourcesOptions = { baseUrl?: string };

/**
 * Resolve a free-text name to canonical resource ids. Search answers no
 * questions (proposal §5.7) — it only maps names/aliases to `{kind}/{slug}` and
 * the URLs to read them.
 */
export function searchResources(
  deps: ResourceContextDeps,
  query: string,
  options: SearchResourcesOptions = {},
): ResourceSearchResponse {
  const tokens = normalizeTokens(query);
  const trimmed = query.trim().toLowerCase();

  const scored = deps.resources
    .map((record) => ({ record, match: scoreMatch(record, trimmed, tokens) }))
    .filter(
      (entry): entry is { record: ResourceContextRecord; match: MatchScore } =>
        entry.match !== null,
    )
    .sort((a, b) => b.match.score - a.match.score);

  return {
    items: scored.map(({ record, match }) => ({
      ...toResourceSummary(record, options.baseUrl),
      matchReason: match.reason,
    })),
  };
}

export type GetResourceContextParams = {
  kind: ResourceKind;
  slug: string;
  /** Optional Section filter; omitted = all Sections registered for the kind. */
  sections?: string[];
  baseUrl?: string;
};

/**
 * Project a resource's Sections by live-resolving its Projection Plan. Identity
 * is spine-first for the `service` kind (plan 017 B4): the availability inventory
 * — not `resources.yaml` — establishes which services exist, so a service in the
 * grid with no governed overlay still renders (`governance: "unconfigured"`,
 * empty Sections, no per-section missing entries), never a 404 nor a faked
 * resolver failure. A governed overlay (any kind) yields `governance:
 * "configured"` and resolves Sections as before. Returns `null` only for a
 * genuine miss (no identity AND no overlay) → HTTP 404 → `searchResources`.
 *
 * A requested Section with no registered binding is reported in `missingSections`
 * (no_registered_source); a Section whose Sources all fail to resolve is returned
 * with `status: unresolved` + warnings — never stale data.
 */
export async function getResourceContext(
  deps: ResourceContextDeps,
  params: GetResourceContextParams,
  ctx: ResolutionContext = defaultResolutionContext(),
): Promise<ResourceContextResponse | null> {
  const overlay = findRecord(deps.resources, params.kind, params.slug);

  // A governed overlay always projects as "configured" — for non-service kinds it
  // IS the identity (no spine, no discovery, unchanged behaviour, B4).
  if (overlay) {
    return projectConfigured(deps, overlay, params, ctx);
  }

  // No overlay. Non-service kinds have no spine, so this is a genuine 404.
  if (params.kind !== "service") {
    return null;
  }

  // Service kind, spine-first: the availability inventory may still establish the
  // resource's existence + canonical identity.
  const identity = findServiceIdentity(deps.availabilityProvider, params.slug);
  if (!identity) {
    return null;
  }
  return projectSpineOnly(deps, identity, params);
}

/**
 * Read a resource's presentation metadata (plan 020 15d, ADR-0015 §1/§2): the
 * Portal-facing identity/owner/entry fields migrated off the Topic. This is NOT
 * content — `getResourceContext` stays content-only; the resource-first page
 * composes this metadata read + that content read. Overlay-backed → the migrated
 * metadata + `governance: "configured"`; a spine-only service → identity-only +
 * `"unconfigured"` (no curated metadata yet); a genuine miss → `null` (404).
 * Synchronous: no Source resolution, no discovery.
 */
export function getResourceRecord(
  deps: Pick<ResourceContextDeps, "resources" | "availabilityProvider">,
  params: { kind: ResourceKind; slug: string },
): ResourceRecordResponse | null {
  const overlay = findRecord(deps.resources, params.kind, params.slug);
  if (overlay) {
    return {
      kind: overlay.kind,
      id: `${overlay.kind}/${overlay.slug}`,
      slug: overlay.slug,
      ...(overlay.provider ? { provider: overlay.provider } : {}),
      name: overlay.name,
      aliases: overlay.aliases,
      governance: "configured",
      ...(overlay.category ? { category: overlay.category } : {}),
      ...(overlay.status ? { status: overlay.status } : {}),
      ...(overlay.description ? { description: overlay.description } : {}),
      ...(overlay.owner_team ? { owner_team: overlay.owner_team } : {}),
      ...(overlay.support_channel ? { support_channel: overlay.support_channel } : {}),
      ...(overlay.entry_tools ? { entry_tools: overlay.entry_tools } : {}),
      ...(overlay.topics ? { topics: overlay.topics } : {}),
    };
  }

  if (params.kind !== "service") {
    return null;
  }
  const identity = findServiceIdentity(deps.availabilityProvider, params.slug);
  if (!identity) {
    return null;
  }
  return {
    kind: "service",
    id: `service/${identity.key}`,
    slug: identity.key,
    provider: identity.provider,
    name: identity.name,
    aliases: identity.admissionAliases,
    governance: "unconfigured",
  };
}

/** Project a governed (overlay-backed) resource: resolve its Section Plan. */
async function projectConfigured(
  deps: ResourceContextDeps,
  record: ResourceContextRecord,
  params: GetResourceContextParams,
  ctx: ResolutionContext,
): Promise<ResourceContextResponse> {
  const requested = resolveRequestedSections(record, params.sections);

  const sectionsOut: Record<string, ContextSection> = {};
  const missingSections: MissingSection[] = [];

  for (const sectionId of requested) {
    const bindings = record.sections[sectionId];
    if (!bindings || bindings.length === 0) {
      missingSections.push({
        section: sectionId,
        code: "no_registered_source",
        message: `Atlas has no registered ${sectionId} source for ${record.kind}/${record.slug}. This is missing data, not evidence of a negative answer.`,
      });
      continue;
    }
    sectionsOut[sectionId] = await resolveSection(deps, bindings, ctx);
  }

  // Reference-only discovery runs ALONGSIDE the governed sections (service kind
  // only): the spine identity enriched with the overlay's curated aliases (B8).
  const discovery = await runDiscovery(deps, discoveryIdentityForRecord(deps, record));

  return {
    resource: toResourceSummary(record, params.baseUrl),
    governance: "configured",
    requestedSections: requested,
    sections: sectionsOut,
    missingSections,
    references: discovery.references,
    referenceDiscovery: discovery.referenceDiscovery,
    // Top-level: the moment THIS projection ran (ADR-0013 §3). Distinct from each
    // citation's resolvedAt, which is the excerpt's own parse time.
    resolvedAt: deps.now.toISOString(),
  };
}

/**
 * Project a spine-only service (in the availability inventory, no governed
 * overlay, B4/B6): the page exists and carries canonical identity, but has no
 * Section Projection Plan yet. Empty Sections + NO per-section missing entries —
 * "unconfigured" is one resource-level signal, never a faked per-section failure.
 */
async function projectSpineOnly(
  deps: ResourceContextDeps,
  identity: ServiceIdentity,
  params: GetResourceContextParams,
): Promise<ResourceContextResponse> {
  const discovery = await runDiscovery(deps, identity);
  return {
    resource: identityToResourceSummary(identity, params.baseUrl),
    governance: "unconfigured",
    requestedSections: [],
    sections: {},
    missingSections: [],
    references: discovery.references,
    referenceDiscovery: discovery.referenceDiscovery,
    resolvedAt: deps.now.toISOString(),
  };
}

/**
 * Run reference-only discovery for a service identity, returning the merged
 * references + an explicit cache state. No port or no identity → empty list +
 * `null` state (honest absence, never fabricated links). Discovery failures are
 * the adapter's job to model as `unavailable`; this facade only merges.
 */
async function runDiscovery(
  deps: ResourceContextDeps,
  identity: ServiceIdentity | undefined,
): Promise<Pick<ResourceContextResponse, "references" | "referenceDiscovery">> {
  if (!deps.referenceDiscovery || !identity) {
    return { references: [], referenceDiscovery: null };
  }
  const result = await deps.referenceDiscovery.discover(identity);
  return {
    references: result.references,
    referenceDiscovery: {
      status: result.status,
      last_observed_at: result.last_observed_at,
      incomplete: result.incomplete,
    },
  };
}

/**
 * The `ServiceIdentity` to hand discovery for a governed (overlay-backed)
 * resource: the spine identity (when the service is in the inventory) enriched
 * with the overlay's curated aliases (B8), falling back to an overlay-derived
 * identity if the service is not in the spine. Non-service kinds → no discovery.
 */
function discoveryIdentityForRecord(
  deps: ResourceContextDeps,
  record: ResourceContextRecord,
): ServiceIdentity | undefined {
  if (record.kind !== "service") {
    return undefined;
  }
  const provider = record.provider ?? record.slug.split("/")[0];
  const id = record.slug.includes("/")
    ? record.slug.slice(record.slug.indexOf("/") + 1)
    : record.slug;
  const spine = deps.availabilityProvider
    .listServices()
    .find((identity) => identity.key === record.slug);
  const base = spine ?? normalizeServiceIdentity({ provider, id, name: record.name });
  return applyOverlayAliases(base, [record.name, ...record.aliases]);
}

/** Resolve a requested service `slug` to its spine `ServiceIdentity` by canonical
 *  `{provider}/{id}` key. Spine-only services are addressed canonically (the
 *  availability grid links use the canonical id). */
function findServiceIdentity(
  availabilityProvider: Pick<AvailabilityProvider, "listServices">,
  slug: string,
): ServiceIdentity | undefined {
  return availabilityProvider.listServices().find((identity) => identity.key === slug);
}

/** Build a ResourceSummary from a spine identity (no overlay). The canonical id
 *  is `service/{provider}/{id}`; aliases come from the normalized identity. */
function identityToResourceSummary(identity: ServiceIdentity, baseUrl?: string): ResourceSummary {
  const id = `service/${identity.key}`;
  const base = baseUrl ?? "";
  return {
    kind: "service",
    id,
    slug: identity.key,
    provider: identity.provider,
    name: identity.name,
    aliases: identity.admissionAliases,
    resourceUrl: `${base}/api/resources/${id}`,
    markdownUrl: `${base}/resources/${id}.md`,
  };
}

/** Resolve one Section by live-resolving each of its ordered bindings. */
async function resolveSection(
  deps: ResourceContextDeps,
  bindings: ResourceSectionBinding[],
  ctx: ResolutionContext,
): Promise<ContextSection> {
  const ordered = [...bindings].sort((a, b) => a.order - b.order);
  const contentParts: string[] = [];
  const citations: ResourceCitation[] = [];
  const warnings: ResourceWarning[] = [];
  let resolvedBindings = 0;

  for (const binding of ordered) {
    const source = deps.registry.sources.getById(binding.source_id);
    if (!source) {
      warnings.push({
        code: "no_registered_source",
        message: `Binding references unknown source '${binding.source_id}'.`,
      });
      continue;
    }

    // Governance warnings are recomputed per projection (never cached): visibility
    // and the staleness clock (ADR-0013 §6).
    if (source.visibility === "restricted") {
      warnings.push({
        code: "restricted_source",
        message: `Source '${source.id}' has restricted visibility.`,
      });
    }
    if (isStale(source, deps.now)) {
      warnings.push({
        code: "stale_source",
        message: `Source '${source.id}' is past its review frequency.`,
      });
    }

    const resolver = deps.resolvers.get(source.source_class);
    if (!resolver) {
      warnings.push({
        code: "source_unavailable",
        message: `No resolver registered for source class '${source.source_class}'.`,
      });
      continue;
    }

    const result = await resolver.resolve({
      source,
      heading: binding.heading,
      selector: binding.selector,
      citationLabel: binding.citation_label,
      contentProvider: deps.contentProvider,
      ctx,
    });

    for (const warning of result.warnings) {
      warnings.push({ code: warning.code, message: warning.message });
    }

    if (result.excerpts.length > 0) {
      resolvedBindings += 1;
      for (const excerpt of result.excerpts) {
        contentParts.push(excerpt.text);
        citations.push({
          sourceId: source.id,
          title: source.title,
          url: excerpt.citation.location,
          // The runtime-located slug (heading-slug scan), never a stored anchor.
          ...(excerpt.anchor_id ? { anchor: excerpt.anchor_id } : {}),
          // Provenance clock: the moment this content was parsed from Source. For
          // the offline/recorded path that is the Source's last observation; the
          // live cache path stamps the real fetch time (kept separate from the
          // staleness clock above — ADR-0013 §6).
          resolvedAt: excerptResolvedAt(excerpt, source.last_observed_at),
        });
      }
    }
  }

  const status: SectionStatus =
    resolvedBindings === 0
      ? "unresolved"
      : resolvedBindings < ordered.length
        ? "partial"
        : "available";

  return {
    status,
    content: contentParts.length > 0 ? contentParts.join("\n\n") : null,
    citations,
    warnings: dedupeWarnings(warnings),
  };
}

/**
 * The excerpt's parse time. The offline resolvers do not (yet) stamp one, so we
 * fall back to the Source's recorded observation time — honest provenance that
 * never claims a static excerpt was "just resolved". The live cache path stamps
 * `resolved_at` on the excerpt directly.
 */
function excerptResolvedAt(excerpt: { resolved_at?: string }, lastObservedAt: string): string {
  return excerpt.resolved_at ?? lastObservedAt;
}

function resolveRequestedSections(
  record: ResourceContextRecord,
  requested: string[] | undefined,
): string[] {
  const kindDef = getResourceKindDef(record.kind);
  const vocab = kindDef
    ? kindDef.sections.map((section) => section.id)
    : Object.keys(record.sections);

  if (!requested || requested.length === 0) {
    return vocab;
  }

  for (const section of requested) {
    if (!KNOWN_SECTION_IDS.has(section)) {
      throw new InvalidResourceRequestError(
        `Unknown section '${section}'. Valid sections come from the OpenAPI 'sections' enum.`,
      );
    }
  }
  // De-duplicate while preserving caller order.
  return Array.from(new Set(requested));
}

/**
 * Resolve a requested `{kind, slug}` to a registered record. Exact canonical
 * `{kind}/{slug}` is the fast path; on a miss we normalize the requested slug
 * and resolve it to a SINGLE same-kind candidate by its name/alias/slug keys, so
 * a caller that only guessed a name ("textract", "AWS Textract", "aws-textract")
 * still lands the canonical resource without a prior searchResources round-trip.
 * Ambiguous (>1) or no match returns `undefined` — the caller still gets the 404
 * that points at searchResources, and the response always carries the canonical
 * id (toResourceSummary uses `record.slug`, never the requested spelling).
 */
function findRecord(
  records: ResourceContextRecord[],
  kind: string,
  slug: string,
): ResourceContextRecord | undefined {
  const exact = records.find((record) => record.kind === kind && record.slug === slug);
  if (exact) {
    return exact;
  }

  const key = normalizeLookupKey(slug);
  if (!key) {
    return undefined;
  }
  const candidates = records.filter(
    (record) => record.kind === kind && recordLookupKeys(record).has(key),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** Collapse a name/slug to one canonical, comparable form (slug separators,
 * casing, and punctuation are all normalized to single hyphens). */
function normalizeLookupKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/** The set of normalized keys a record answers to: its slug, the slug tail, the
 * `provider-tail` form, its name, and every alias. */
function recordLookupKeys(record: ResourceContextRecord): Set<string> {
  const tail = record.slug.includes("/")
    ? record.slug.slice(record.slug.lastIndexOf("/") + 1)
    : record.slug;
  const raw = [record.slug, tail, record.name, ...record.aliases];
  if (record.provider) {
    raw.push(`${record.provider}-${tail}`);
  }
  return new Set(raw.map(normalizeLookupKey).filter((value) => value.length > 0));
}

function toResourceSummary(record: ResourceContextRecord, baseUrl?: string): ResourceSummary {
  const id = `${record.kind}/${record.slug}`;
  const base = baseUrl ?? "";
  return {
    kind: record.kind,
    id,
    slug: record.slug,
    ...(record.provider ? { provider: record.provider } : {}),
    name: record.name,
    aliases: record.aliases,
    resourceUrl: `${base}/api/resources/${id}`,
    markdownUrl: `${base}/resources/${id}.md`,
  };
}

type MatchScore = { score: number; reason: string };

function scoreMatch(
  record: ResourceContextRecord,
  trimmedQuery: string,
  tokens: string[],
): MatchScore | null {
  const names = [record.name, ...record.aliases].map((value) => value.toLowerCase());
  if (trimmedQuery.length > 0 && names.includes(trimmedQuery)) {
    return { score: 100, reason: "Exact name or alias match" };
  }

  const haystack = [record.name, ...record.aliases, record.slug, record.provider ?? "", record.kind]
    .join(" ")
    .toLowerCase();

  if (tokens.length === 0) {
    return null;
  }
  const matched = tokens.filter((token) => haystack.includes(token));
  if (matched.length === tokens.length) {
    return { score: 50, reason: "Matched on name and aliases" };
  }
  if (matched.length > 0) {
    return { score: 10, reason: "Partial name match" };
  }
  return null;
}

function normalizeTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 2);
}

function dedupeWarnings(warnings: ResourceWarning[]): ResourceWarning[] {
  const seen = new Set<string>();
  const unique: ResourceWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}::${warning.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(warning);
    }
  }
  return unique;
}
