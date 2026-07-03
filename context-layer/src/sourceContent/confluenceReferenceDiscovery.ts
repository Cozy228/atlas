/**
 * Live Confluence reference-discovery adapter (plan 017 Batch 5, ADR-0016).
 *
 * Implements `ResourceReferenceDiscovery` against the generic Confluence Cloud
 * CQL search endpoint (`GET /wiki/rest/api/content/search`, v1) — net-new vs the
 * v2 single-page content reads, but sharing the SAME `ConfluenceLiveConfig` +
 * auth scheme + injectable `FetchLike`. It is reference-only: it learns that
 * pages EXIST, never reads their bodies (decision #1, §Honesty).
 *
 * The pipeline per service (one CQL + one cache unit per `identity.key`, B10):
 *   1. WIDE recall — `(title ~ a1 OR title ~ a2 …) AND space in (…) AND type = page`
 *      from the identity's `recallAliases` (the bare slug is recall-eligible).
 *   2. DOUBLE-HIT admission — a candidate is admitted ONLY when its title hits
 *      BOTH (a) a complete `admissionAlias` token-sequence (B9 identity hit) AND
 *      (b) a controlled doc-type pattern (B11). Non-matches go to diagnostics
 *      (structured log/count), never an `other` bucket.
 *   3. In-process per-key last-good cache with SWR + single-flight + max-staleness
 *      + recall cap (decision #5, B12): fresh<1h served directly; 1h–24h served
 *      stale + background refresh; >24h refused (`unavailable`, never unbounded
 *      stale); recall truncated at 50 → `incomplete:true` + log.
 *
 * Space-listing fallback (separate security Cloud): a security-policy instance whose
 * token lacks the search capability answers CQL search with 401/403 but still serves
 * plain space listing. So an `extraInstance` channel that hits 401/403 on CQL flips
 * (stickily) to enumerating its whole space once — cached at the channel level, shared
 * by every service — and applies the SAME double-hit admission locally per identity.
 * Only `extraInstances` fall back; the primary channel stays CQL-only (its space may be
 * large and unbounded to list), so a primary 401/403 is an honest gap as before.
 *
 * Public-safe: no real space keys / page ids / credentials are baked in — all
 * come from the injected config. Server/Data Center is out of scope (Cloud only).
 */
import type { DiscoveredReference, DocType, ServiceIdentity } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  confluenceAuthorization,
  resolveConfluenceNextUrl,
  type ConfluenceLiveConfig,
} from "./confluenceCloudContentProvider";
// Doc-type classification is a kernel rule (plan 018 B11) — moved to the
// rules-only kernel and re-imported so admission behavior is unchanged.
import { judgeDocType } from "../kernel/docTypePatterns";
import type {
  ResourceReferenceDiscovery,
  ResourceReferenceDiscoveryResult,
} from "../services/resourceReferenceDiscovery";

/* -------------------------------------------------------------------------- *
 * B12 cache thresholds + recall cap                                          */
const FRESH_TTL_MS = 60 * 60 * 1000; // 1h — serve cache directly within window
const MAX_STALENESS_MS = 24 * 60 * 60 * 1000; // 24h — past this → unavailable
const RECALL_CAP = 50; // per-service recall cap → incomplete + log on truncation
// Space-listing fallback: page size + max requests per space (bounded crawl — a
// space larger than this lists `incomplete`, never pages forever).
const LISTING_PAGE_SIZE = 100;
const LISTING_MAX_REQUESTS = 20;

/** One Confluence Cloud instance to recall from: its base URL + auth + the space
 *  keys recall is scoped to. */
export type ConfluenceReferenceInstance = ConfluenceLiveConfig & {
  /** Space keys to scope recall to. O(spaces) — start with 1 (config surface). */
  spaceKeys: string[];
};

export type ConfluenceReferenceDiscoveryConfig = ConfluenceReferenceInstance & {
  /**
   * Additional Confluence instances (e.g. a SEPARATE security-policy Cloud with
   * its own base URL / credentials) recalled per service alongside the primary.
   * Each fires its own CQL; the admitted references merge into the same service's
   * reference list (deduped by URL). Omitted / empty → primary instance only.
   */
  extraInstances?: ConfluenceReferenceInstance[];
};

/** Structured discovery diagnostic — counts only, never a user surface (B4). */
export type DiscoveryDiagnostic = {
  key: string;
  recalled: number;
  admitted: number;
  rejected: number;
  truncated: boolean;
};

export type ConfluenceReferenceDiscoveryDeps = {
  fetch: FetchLike;
  /** Injectable clock (epoch ms) for the cache — defaults to `Date.now`. */
  now?: () => number;
  /** Diagnostics sink for recall/admission counts — defaults to no-op. */
  onDiagnostic?: (diagnostic: DiscoveryDiagnostic) => void;
};

/** One page discovered by space listing, pre-judged for its doc-type (the
 *  identity-independent half of admission) so per-service filtering is local. */
type JudgedPage = { title: string; url: string; docType: DocType };

/** A channel-scoped full-space listing (loaded once, shared by every service). */
type ChannelListing = { pages: JudgedPage[]; observedAtMs: number; incomplete: boolean };

/** A resolved recall target: one Confluence instance's base URL + auth + spaces. */
type Channel = {
  baseUrl: string;
  authorization: string;
  spaceKeys: string[];
  /** Only a separate security Cloud (`extraInstances`) may fall back to space
   *  listing when CQL search is forbidden; the primary channel stays CQL-only. */
  allowSpaceListingFallback: boolean;
  /** Sticky: set once CQL search returns 401/403 → route straight to listing after. */
  cqlForbidden: boolean;
  /** Channel-scoped listing cache + its single-flight (populated only on fallback). */
  listing?: ChannelListing;
  listingInflight?: Promise<ChannelListing | null>;
};

type ChannelRecall =
  | {
      ok: true;
      references: DiscoveredReference[];
      truncated: boolean;
      recalled: number;
      rejected: number;
    }
  | { ok: false };

type CacheEntry = {
  references: DiscoveredReference[];
  observedAtMs: number;
  incomplete: boolean;
};

type FetchOutcome =
  | { ok: true; references: DiscoveredReference[]; incomplete: boolean; observedAtMs: number }
  | { ok: false };

export function createConfluenceReferenceDiscovery(
  config: ConfluenceReferenceDiscoveryConfig,
  deps: ConfluenceReferenceDiscoveryDeps,
): ResourceReferenceDiscovery {
  const now = deps.now ?? (() => Date.now());
  const onDiagnostic = deps.onDiagnostic ?? (() => {});

  // The instances recalled per service: the primary (config itself) plus any
  // `extraInstances` (e.g. a separate security-policy Cloud). Each precomputes its
  // trimmed base URL + auth header once. Only `extraInstances` are listing-fallback
  // eligible — the primary stays CQL-only (see the file header).
  const channels: Channel[] = [
    { instance: config as ConfluenceReferenceInstance, fallback: false },
    ...(config.extraInstances ?? []).map((instance) => ({ instance, fallback: true })),
  ].map(({ instance, fallback }) => ({
    baseUrl: instance.baseUrl.replace(/\/+$/, ""),
    authorization: confluenceAuthorization(instance),
    spaceKeys: instance.spaceKeys,
    allowSpaceListingFallback: fallback,
    cqlForbidden: false,
  }));

  // Per-`identity.key` last-good cache + in-flight single-flight map. In-process
  // only — no cross-instance / cross-restart store (decision #5).
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<FetchOutcome>>();

  /** Single-flight refresh: concurrent callers for one key share one fetch. */
  function refresh(identity: ServiceIdentity): Promise<FetchOutcome> {
    const existing = inflight.get(identity.key);
    if (existing) {
      return existing;
    }
    const promise = fetchReferences(identity)
      .then((outcome) => {
        if (outcome.ok) {
          cache.set(identity.key, {
            references: outcome.references,
            observedAtMs: outcome.observedAtMs,
            incomplete: outcome.incomplete,
          });
        }
        inflight.delete(identity.key);
        return outcome;
      })
      .catch(() => {
        inflight.delete(identity.key);
        return { ok: false } as FetchOutcome;
      });
    inflight.set(identity.key, promise);
    return promise;
  }

  /**
   * Recall a service across every channel and merge. Each channel is one CQL +
   * double-hit admission; references dedupe by URL (first wins). All channels
   * failing → ok:false (honest gap). At least one succeeding → ok:true; a channel
   * that failed leaves its instance unknown, so the merged result is `incomplete`.
   */
  async function fetchReferences(identity: ServiceIdentity): Promise<FetchOutcome> {
    const observedAtMs = now();
    const observedAtIso = new Date(observedAtMs).toISOString();

    const byUrl = new Map<string, DiscoveredReference>();
    let anyOk = false;
    let anyFailed = false;
    let anyTruncated = false;
    let recalledTotal = 0;
    let rejectedTotal = 0;

    for (const channel of channels) {
      const result = await recallChannel(channel, identity, observedAtIso);
      if (!result.ok) {
        anyFailed = true;
        continue;
      }
      anyOk = true;
      anyTruncated = anyTruncated || result.truncated;
      recalledTotal += result.recalled;
      rejectedTotal += result.rejected;
      for (const reference of result.references) {
        if (!byUrl.has(reference.url)) {
          byUrl.set(reference.url, reference);
        }
      }
    }

    if (!anyOk) {
      return { ok: false };
    }

    const references = [...byUrl.values()];
    onDiagnostic({
      key: identity.key,
      recalled: recalledTotal,
      admitted: references.length,
      rejected: rejectedTotal,
      truncated: anyTruncated,
    });
    return { ok: true, references, incomplete: anyTruncated || anyFailed, observedAtMs };
  }

  /**
   * One channel's recall + double-hit admission. Never throws (→ ok:false).
   * A listing-fallback channel already known to lack CQL search (`cqlForbidden`)
   * recalls straight from the space listing; otherwise it tries CQL first and, on
   * a 401/403, flips (stickily) to listing.
   */
  async function recallChannel(
    channel: Channel,
    identity: ServiceIdentity,
    observedAtIso: string,
  ): Promise<ChannelRecall> {
    if (channel.cqlForbidden) {
      return recallFromListing(channel, identity, observedAtIso);
    }

    const cql = buildCql(identity.recallAliases, channel.spaceKeys);
    const url = `${channel.baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${RECALL_CAP}`;

    let payload: CqlSearchResponse;
    try {
      const response = await deps.fetch(url, {
        method: "GET",
        headers: { Authorization: channel.authorization, Accept: "application/json" },
      });
      if (!response.ok) {
        // A security instance without search scope 401/403s CQL but still serves
        // space listing — flip (sticky) and recall from the listing instead of
        // reporting a gap. Only extra (security) channels do this; the primary's
        // 401/403 stays an honest gap (its space is unbounded to list).
        if (
          channel.allowSpaceListingFallback &&
          (response.status === 401 || response.status === 403)
        ) {
          channel.cqlForbidden = true;
          return recallFromListing(channel, identity, observedAtIso);
        }
        return { ok: false };
      }
      payload = (await response.json()) as CqlSearchResponse;
    } catch {
      return { ok: false };
    }

    const results = payload.results ?? [];
    const truncated =
      Boolean(payload._links?.next) ||
      (typeof payload.totalSize === "number" && payload.totalSize > results.length) ||
      results.length >= RECALL_CAP;

    const references: DiscoveredReference[] = [];
    let rejected = 0;
    for (const candidate of results) {
      const title = candidate.title ?? candidate.content?.title;
      const webui = candidate._links?.webui ?? candidate.content?._links?.webui;
      if (!title || !webui) {
        rejected += 1;
        continue;
      }
      // Double hit: identity AND doc-type, or it goes to diagnostics (B9 + B11).
      if (!identityHit(title, identity.admissionAliases)) {
        rejected += 1;
        continue;
      }
      const docType = judgeDocType(title);
      if (!docType) {
        rejected += 1;
        continue;
      }
      references.push(
        buildReference(title, absoluteUrl(channel.baseUrl, webui), docType, observedAtIso),
      );
    }

    return { ok: true, references, truncated, recalled: results.length, rejected };
  }

  /**
   * Recall from the channel's cached space listing (loaded once): every listed page
   * already cleared the doc-type gate, so admission here is just the per-service
   * identity hit. Failure to load the listing → ok:false (honest gap).
   */
  async function recallFromListing(
    channel: Channel,
    identity: ServiceIdentity,
    observedAtIso: string,
  ): Promise<ChannelRecall> {
    const listing = await ensureListing(channel);
    if (!listing) {
      return { ok: false };
    }
    const references: DiscoveredReference[] = [];
    let rejected = 0;
    for (const page of listing.pages) {
      if (!identityHit(page.title, identity.admissionAliases)) {
        rejected += 1;
        continue;
      }
      references.push(buildReference(page.title, page.url, page.docType, observedAtIso));
    }
    return {
      ok: true,
      references,
      truncated: listing.incomplete,
      recalled: listing.pages.length,
      rejected,
    };
  }

  /**
   * Load-or-reuse the channel's full-space listing: fresh within `FRESH_TTL_MS`,
   * otherwise reload (single-flight, so concurrent services share one crawl). On a
   * failed reload the prior listing is kept (serve last-good) rather than dropped.
   */
  function ensureListing(channel: Channel): Promise<ChannelListing | null> {
    const nowMs = now();
    if (channel.listing && nowMs - channel.listing.observedAtMs <= FRESH_TTL_MS) {
      return Promise.resolve(channel.listing);
    }
    if (channel.listingInflight) {
      return channel.listingInflight;
    }
    const promise = loadSpaceListing(channel)
      .then((loaded) => {
        channel.listingInflight = undefined;
        if (loaded) {
          channel.listing = { ...loaded, observedAtMs: now() };
          return channel.listing;
        }
        return channel.listing ?? null;
      })
      .catch(() => {
        channel.listingInflight = undefined;
        return channel.listing ?? null;
      });
    channel.listingInflight = promise;
    return promise;
  }

  /**
   * Enumerate every page across the channel's spaces, pre-judging each title's
   * doc-type (dropping non-doc pages). A space that cannot be listed fails the whole
   * channel (null → honest gap). `incomplete` when any space's crawl was capped.
   */
  async function loadSpaceListing(
    channel: Channel,
  ): Promise<Omit<ChannelListing, "observedAtMs"> | null> {
    const pages: JudgedPage[] = [];
    let incomplete = false;
    for (const spaceKey of channel.spaceKeys) {
      const listed = await listSpace(channel, spaceKey);
      if (!listed.ok) {
        return null;
      }
      incomplete = incomplete || listed.truncated;
      for (const raw of listed.pages) {
        const docType = judgeDocType(raw.title);
        if (!docType) {
          continue; // non-doc page → not reference-eligible (same doc-type gate as CQL)
        }
        pages.push({ title: raw.title, url: absoluteUrl(channel.baseUrl, raw.webui), docType });
      }
    }
    return { pages, incomplete };
  }

  /** List one space via the v1 space-content endpoint, following `_links.next`
   *  (bounded by `LISTING_MAX_REQUESTS`). Never throws (→ ok:false). */
  async function listSpace(
    channel: Channel,
    spaceKey: string,
  ): Promise<
    { ok: true; pages: Array<{ title: string; webui: string }>; truncated: boolean } | { ok: false }
  > {
    const pages: Array<{ title: string; webui: string }> = [];
    let next: string | undefined = `${channel.baseUrl}/wiki/rest/api/space/${encodeURIComponent(
      spaceKey,
    )}/content/page?limit=${LISTING_PAGE_SIZE}`;
    let requests = 0;

    while (next) {
      if (requests >= LISTING_MAX_REQUESTS) {
        return { ok: true, pages, truncated: true };
      }
      requests += 1;

      let payload: SpaceContentResponse;
      try {
        const response = await deps.fetch(next, {
          method: "GET",
          headers: { Authorization: channel.authorization, Accept: "application/json" },
        });
        if (!response.ok) {
          return { ok: false };
        }
        payload = (await response.json()) as SpaceContentResponse;
      } catch {
        return { ok: false };
      }

      for (const result of payload.results ?? []) {
        const title = result.title;
        const webui = result._links?.webui;
        if (title && webui) {
          pages.push({ title, webui });
        }
      }
      next = resolveConfluenceNextUrl(channel.baseUrl, payload._links);
    }

    return { ok: true, pages, truncated: false };
  }

  function serve(entry: CacheEntry, status: ResourceReferenceDiscoveryResult["status"]) {
    return {
      references: entry.references,
      status,
      last_observed_at: new Date(entry.observedAtMs).toISOString(),
      incomplete: entry.incomplete,
    } satisfies ResourceReferenceDiscoveryResult;
  }

  return {
    async discover(identity) {
      const entry = cache.get(identity.key);

      // Cold miss → synchronous fetch. Failure on cold start = honest gap.
      if (!entry) {
        const outcome = await refresh(identity);
        const refreshed = cache.get(identity.key);
        if (outcome.ok && refreshed) {
          return serve(refreshed, "fresh");
        }
        return { references: [], status: "unavailable", last_observed_at: null, incomplete: false };
      }

      const age = now() - entry.observedAtMs;
      if (age <= FRESH_TTL_MS) {
        return serve(entry, "fresh");
      }

      if (age <= MAX_STALENESS_MS) {
        // Serve last-good stale + single-flight background refresh (best-effort;
        // a failed refresh keeps last-good — never a regression to nothing).
        void refresh(identity);
        return serve(entry, "stale");
      }

      // Past max-staleness: too old to serve. Try a synchronous refresh; if it
      // fails, refuse the unbounded-stale entry and report unavailable (the old
      // last_observed_at still tells the consumer how stale the last good was).
      const outcome = await refresh(identity);
      const refreshed = cache.get(identity.key);
      if (outcome.ok && refreshed) {
        return serve(refreshed, "fresh");
      }
      return {
        references: [],
        status: "unavailable",
        last_observed_at: new Date(entry.observedAtMs).toISOString(),
        incomplete: false,
      };
    },
  };
}

/* -------------------------------------------------------------------------- *
 * CQL                                                                        */

function buildCql(recallAliases: string[], spaceKeys: string[]): string {
  const titleClause = recallAliases.map((alias) => `title ~ ${cqlQuote(alias)}`).join(" OR ");
  const spaceClause =
    spaceKeys.length > 0 ? ` AND space in (${spaceKeys.map(cqlQuote).join(", ")})` : "";
  return `(${titleClause})${spaceClause} AND type = page`;
}

/** Quote + neutralize embedded quotes for a CQL string literal. */
function cqlQuote(value: string): string {
  return `"${value.replace(/"/g, " ").trim()}"`;
}

/* -------------------------------------------------------------------------- *
 * Admission — identity hit (B9) + doc-type judge (B11)                        */

/** Identity hit: the normalized title must contain a COMPLETE admissionAlias
 *  token-sequence (contiguous tokens), refiltering CQL's fuzzy recall (B9). */
function identityHit(title: string, admissionAliases: string[]): boolean {
  const titleTokens = tokenize(title);
  return admissionAliases.some((alias) =>
    containsSubsequence(
      titleTokens,
      alias.split(" ").filter((token) => token.length > 0),
    ),
  );
}

/* -------------------------------------------------------------------------- *
 * Helpers                                                                    */

function buildReference(
  title: string,
  url: string,
  docType: DocType,
  observedAtIso: string,
): DiscoveredReference {
  return {
    title,
    url,
    doc_type: docType,
    last_observed_at: observedAtIso,
    content_mode: "reference_only",
    access_mode: "service_credentials",
    agent_accessible: false,
  };
}

function absoluteUrl(baseUrl: string, webui: string): string {
  if (/^https?:\/\//i.test(webui)) {
    return webui;
  }
  return `${baseUrl}${webui.startsWith("/") ? "" : "/"}${webui}`;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** True when `needle` appears as a CONTIGUOUS run inside `haystack`. */
function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------------------- *
 * Confluence CQL v1 search response (the subset we read)                      */

type CqlSearchResult = {
  title?: string;
  _links?: { webui?: string };
  content?: { title?: string; _links?: { webui?: string } };
};

type CqlSearchResponse = {
  results?: CqlSearchResult[];
  totalSize?: number;
  _links?: { next?: string };
};

/* -------------------------------------------------------------------------- *
 * Confluence v1 space-content listing response (the fallback recall subset)   */

type SpaceContentResult = { title?: string; _links?: { webui?: string } };

type SpaceContentResponse = {
  results?: SpaceContentResult[];
  _links?: { next?: string; base?: string };
};
