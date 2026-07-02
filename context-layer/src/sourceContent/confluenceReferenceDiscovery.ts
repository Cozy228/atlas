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
 * Public-safe: no real space keys / page ids / credentials are baked in — all
 * come from the injected config. Server/Data Center is out of scope (Cloud only).
 */
import type { DiscoveredReference, DocType, ServiceIdentity } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  confluenceAuthorization,
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

/** A resolved recall target: one Confluence instance's base URL + auth + spaces. */
type Channel = {
  baseUrl: string;
  authorization: string;
  spaceKeys: string[];
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
  // trimmed base URL + auth header once.
  const channels: Channel[] = [config, ...(config.extraInstances ?? [])].map((instance) => ({
    baseUrl: instance.baseUrl.replace(/\/+$/, ""),
    authorization: confluenceAuthorization(instance),
    spaceKeys: instance.spaceKeys,
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

  /** One channel's CQL recall + double-hit admission. Never throws (→ ok:false). */
  async function recallChannel(
    channel: Channel,
    identity: ServiceIdentity,
    observedAtIso: string,
  ): Promise<ChannelRecall> {
    const cql = buildCql(identity.recallAliases, channel.spaceKeys);
    const url = `${channel.baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${RECALL_CAP}`;

    let payload: CqlSearchResponse;
    try {
      const response = await deps.fetch(url, {
        method: "GET",
        headers: { Authorization: channel.authorization, Accept: "application/json" },
      });
      if (!response.ok) {
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
