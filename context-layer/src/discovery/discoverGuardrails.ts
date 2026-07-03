/**
 * Guardrail discovery (list-only, plan 0.2.0) — the security-policy analog of
 * service source discovery. Services come from the availability spine; guardrails
 * are enumerated by listing a dedicated security-policy Confluence SPACE via the v1
 * space-content listing (`GET /wiki/rest/api/space/<KEY>/content/page`, paginated).
 * That listing IS the "get a list" step: it yields each page's `{title, pageId}`
 * cheaply, WITHOUT fetching page bodies.
 *
 * A page's storage-HTML heading TOC (→ section bindings) is NOT read here — it is
 * fetched LAZILY, per-guardrail, only when that policy's detail/context is read
 * (see `resourceContentDiscovery`). So the catalog/home path issues at most a few
 * bounded listing requests, never one-fetch-per-page. The normative half (which
 * heading backs which section) is the kernel's `SECTION_RULES.guardrail`, applied
 * in `deriveGuardrails` at enrichment time.
 *
 * The listing endpoint is a plain space enumeration, NOT the CQL search endpoint
 * (`/wiki/rest/api/content/search`): a security-policy Confluence instance whose
 * token lacks the search capability answers CQL search with 403 but still serves
 * space listing — so crawling by listing is the path that works there.
 *
 * Single live path: the only fetch target is the Confluence source system (dev =
 * MSW, prod = real), reached through `ctx.fetch`. An unconfigured channel is an
 * honest-empty result (no guardrails), never a fabricated fallback.
 */
import { parse } from "node-html-parser";
import {
  confluenceAuthorization,
  resolveConfluenceNextUrl,
} from "../sourceContent/confluenceCloudContentProvider";
import { logger, serializeError } from "../observability/logging";
import type { ResolutionContext } from "../resolvers/resolverTypes";

/** Page size per listing request, and the max requests before a crawl is capped
 *  (bounded even for an unexpectedly large space → truncated, never unbounded). */
const LISTING_PAGE_SIZE = 100;
const LISTING_MAX_REQUESTS = 20;

/** One discovered security-policy page (descriptive facts only). */
export type DiscoveredGuardrail = {
  /** Kebab-case slug derived from the page title — the binding/source key stem. */
  slug: string;
  /** The page title — the guardrail's display name. */
  name: string;
  /** The Confluence page id — the policy-document Source `location`. */
  pageId: string;
  /** The page's full ordered heading list (the storage-HTML TOC). Empty from the
   *  list-only discovery pass; filled lazily on detail read (`resourceContentDiscovery`). */
  headings: string[];
};

export type DiscoverGuardrailsDeps = {
  /** Late-bound fetch context (dev MSW / prod real / unit fake). */
  ctx: ResolutionContext;
  /**
   * Confluence deployment config + WHERE to enumerate guardrail pages. Two scopes,
   * `rootPageId` preferred:
   *  - `rootPageId` (`CONFLUENCE_SECURITY_ROOT_PAGE_ID`, e.g. the "AWS Public Cloud"
   *    page): enumerate only that page's direct CHILD pages (v2 `/pages/{id}/children`).
   *    Scopes the crawl to the actual policy pages instead of the whole space — a
   *    900-page space that lists in 9 batches collapses to the handful of pages that
   *    are real guardrails, in ~1 request. Direct children only: a policy's own
   *    sub-pages do NOT each become a spurious guardrail. This is tree navigation,
   *    NOT CQL search, so it needs no search scope (the capability the security
   *    instance 403s on).
   *  - `spaceKey` (`CONFLUENCE_SECURITY_SPACE_KEY`): fall back to enumerating the
   *    WHOLE space (v1 space-content listing) when no root page is configured.
   */
  confluence: {
    baseUrl: string;
    token: string;
    email?: string;
    spaceKey: string;
    rootPageId?: string;
  };
};

/**
 * List the security-policy space for guardrail pages (list-only): the space
 * enumeration recall(s) ONLY — no per-page body fetch. Each listed page becomes a
 * `DiscoveredGuardrail` with an EMPTY `headings` (its TOC is read lazily on detail).
 * Honest-empty when the channel is unconfigured or the listing fails — discovery
 * never invents a guardrail.
 */
export async function discoverGuardrails(
  deps: DiscoverGuardrailsDeps,
): Promise<DiscoveredGuardrail[]> {
  const { ctx, confluence } = deps;
  const log = logger("discovery");
  // No Confluence channel + no scope configured = honest gap (no guardrails). A
  // scope is either a root page (preferred) or a whole-space key.
  const hasScope = Boolean(confluence.rootPageId || confluence.spaceKey);
  if (!confluence.baseUrl || !confluence.token || !hasScope) {
    const missing = [
      !confluence.baseUrl ? "baseUrl" : null,
      !confluence.token ? "token" : null,
      !hasScope ? "CONFLUENCE_SECURITY_ROOT_PAGE_ID or CONFLUENCE_SECURITY_SPACE_KEY" : null,
    ].filter(Boolean);
    log.info(
      { missing },
      `guardrail confluence channel not configured (${missing.join(", ")} unset) — 0 guardrails discovered`,
    );
    return [];
  }

  const config = {
    baseUrl: confluence.baseUrl,
    token: confluence.token,
    email: confluence.email,
  };
  const baseUrl = confluence.baseUrl.replace(/\/+$/, "");
  const authorization = confluenceAuthorization(config);

  // Prefer the scoped child-page crawl when a root page is configured; else the
  // whole-space listing.
  const listed = confluence.rootPageId
    ? await listChildPages(ctx, baseUrl, authorization, confluence.rootPageId)
    : await listSpacePages(ctx, baseUrl, authorization, confluence.spaceKey);
  const scope = confluence.rootPageId
    ? `page ${confluence.rootPageId} children`
    : `space ${confluence.spaceKey}`;
  if (!listed.ok) {
    log.warn(
      { scope, status: listed.status, err: listed.err },
      listed.status === undefined
        ? `guardrail listing failed for ${scope} — 0 guardrails discovered`
        : `guardrail listing returned ${listed.status} for ${scope} — 0 guardrails discovered`,
    );
    return [];
  }
  const pages = listed.pages;

  // List-only: map each listed page straight to a guardrail. No body is fetched —
  // `headings` stays empty until the policy's detail/context is read.
  const guardrails: DiscoveredGuardrail[] = pages.map(({ title, pageId }) => ({
    slug: slugify(title),
    name: title,
    pageId,
    headings: [],
  }));
  log.info(
    { scope, discovered: guardrails.length },
    `guardrail discovery (list-only): ${guardrails.length} page(s) from ${scope} — page bodies fetched lazily on detail`,
  );
  return guardrails;
}

/** Collect the human text of every storage-HTML SECTION heading, in document
 *  order — the raw TOC. The page's `<h1>` is its title, not a section, so it is
 *  excluded (only `<h2>`–`<h6>` are bindable sections); each entry is still a
 *  heading the runtime section locator can resolve. Exported for the lazy
 *  per-policy content enricher (`resourceContentDiscovery`). */
export function parseStorageHeadings(html: string): string[] {
  if (!html.trim()) {
    return [];
  }
  return parse(html)
    .querySelectorAll("h2, h3, h4, h5, h6")
    .map((heading) => heading.text.trim())
    .filter((text) => text.length > 0);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* -------------------------------------------------------------------------- *
 * Space-content listing (v1) — page enumeration for one space                 */

type ListedPages =
  | { ok: true; pages: Array<{ title: string; pageId: string }> }
  | { ok: false; status?: number; err?: ReturnType<typeof serializeError> };

/**
 * Enumerate every page in `spaceKey` via the v1 space-content listing, following
 * `_links.next` (bounded by `LISTING_MAX_REQUESTS`). Any non-OK status or transport
 * failure short-circuits to `ok:false` so the caller reports an honest gap (never a
 * partial guardrail set silently passed off as complete).
 */
async function listSpacePages(
  ctx: ResolutionContext,
  baseUrl: string,
  authorization: string,
  spaceKey: string,
): Promise<ListedPages> {
  const collected: Array<{ title: string; pageId: string }> = [];
  let next: string | undefined = `${baseUrl}/wiki/rest/api/space/${encodeURIComponent(
    spaceKey,
  )}/content/page?limit=${LISTING_PAGE_SIZE}`;
  let requests = 0;

  while (next) {
    if (requests >= LISTING_MAX_REQUESTS) {
      break; // bounded crawl — a runaway space stops here rather than paging forever
    }
    requests += 1;

    let payload: SpaceContentResponse;
    try {
      const response = await ctx.fetch(next, {
        method: "GET",
        headers: { Authorization: authorization, Accept: "application/json" },
      });
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      payload = (await response.json()) as SpaceContentResponse;
    } catch (error) {
      return { ok: false, err: serializeError(error) };
    }

    for (const result of payload.results ?? []) {
      const title = result.title;
      const pageId = result.id ?? result._links?.webui?.match(/\/pages\/(\d+)/)?.[1];
      if (title && pageId) {
        collected.push({ title, pageId });
      }
    }
    next = resolveConfluenceNextUrl(baseUrl, payload._links);
  }

  return { ok: true, pages: collected };
}

/* -------------------------------------------------------------------------- *
 * Child-page listing (v2) — direct child pages of one root page (scoped)       */

/** v2 caps `limit` at 250; a larger page size means fewer round-trips than the
 *  v1 100-cap space listing. */
const CHILDREN_PAGE_SIZE = 250;

/**
 * Enumerate the direct CHILD pages of `rootPageId` via v2 `/pages/{id}/children`,
 * following the response cursor (bounded by `LISTING_MAX_REQUESTS`). The endpoint
 * returns child PAGES only (not a policy's own nested sub-pages, nor folders /
 * whiteboards), so no type filter is needed; archived/draft children are still
 * dropped. Any non-OK status or transport failure short-circuits to `ok:false`
 * (honest gap), so a partial set is never passed off as complete.
 *
 * Pagination is driven by the `cursor` parsed out of `_links.next` and re-applied to
 * a fixed base URL — robust to whether Confluence returns the next link absolute or
 * relative, with or without the `/wiki` prefix.
 */
async function listChildPages(
  ctx: ResolutionContext,
  baseUrl: string,
  authorization: string,
  rootPageId: string,
): Promise<ListedPages> {
  const collected: Array<{ title: string; pageId: string }> = [];
  const endpoint = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(
    rootPageId,
  )}/children?limit=${CHILDREN_PAGE_SIZE}`;
  let next: string | undefined = endpoint;
  let requests = 0;

  while (next) {
    if (requests >= LISTING_MAX_REQUESTS) {
      break; // bounded crawl — a runaway child set stops here rather than paging forever
    }
    requests += 1;

    let payload: ChildrenResponse;
    try {
      const response = await ctx.fetch(next, {
        method: "GET",
        headers: { Authorization: authorization, Accept: "application/json" },
      });
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
      payload = (await response.json()) as ChildrenResponse;
    } catch (error) {
      return { ok: false, err: serializeError(error) };
    }

    for (const result of payload.results ?? []) {
      // Children are already pages; just drop archived/draft ones.
      if (result.status && result.status !== "current") {
        continue;
      }
      if (result.title && result.id) {
        collected.push({ title: result.title, pageId: result.id });
      }
    }
    const cursor = nextCursor(payload._links?.next);
    next = cursor ? `${endpoint}&cursor=${encodeURIComponent(cursor)}` : undefined;
  }

  return { ok: true, pages: collected };
}

/** Pull the `cursor` query value out of a v2 `_links.next` (absolute or relative). */
function nextCursor(next: string | undefined): string | undefined {
  if (!next) {
    return undefined;
  }
  const query = next.includes("?") ? next.slice(next.indexOf("?") + 1) : next;
  return new URLSearchParams(query).get("cursor") ?? undefined;
}

/* v2 children response (the subset we read). */
type ChildResult = { id?: string; title?: string; status?: string };
type ChildrenResponse = {
  results?: ChildResult[];
  _links?: { next?: string; base?: string };
};

/* -------------------------------------------------------------------------- *
 * Confluence v1 space-content response (the subset we read)                   */

type SpaceContentResult = { id?: string; title?: string; _links?: { webui?: string } };

type SpaceContentResponse = {
  results?: SpaceContentResult[];
  _links?: { next?: string; base?: string };
};
