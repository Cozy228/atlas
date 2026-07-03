/**
 * Guardrail discovery (plan 018 G5) — the security-policy analog of service
 * source discovery. Services come from the availability spine; guardrails are
 * discovered by crawling a dedicated security-policy Confluence SPACE: list every
 * page in the space via the v1 space-content listing (`GET /wiki/rest/api/space/
 * <KEY>/content/page`, paginated), then fetch each page and read its storage-HTML
 * heading TOC. The descriptive half (which page exists / its headings) lives here;
 * the normative half (which heading backs which section) is the kernel's
 * `SECTION_RULES.guardrail`, applied in `deriveGuardrails`.
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
  fetchConfluenceStorageHtml,
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
  /** The page's full ordered heading list (the storage-HTML TOC). */
  headings: string[];
};

export type DiscoverGuardrailsDeps = {
  /** Late-bound fetch context (dev MSW / prod real / unit fake). */
  ctx: ResolutionContext;
  /** Confluence deployment config + the security-policy space to crawl. */
  confluence: { baseUrl: string; token: string; email?: string; spaceKey: string };
};

/**
 * Crawl the security-policy space for guardrail pages: one CQL listing recall +
 * one page fetch per recalled page (concurrent). Honest-empty when the channel
 * is unconfigured or the recall fails — discovery never invents a guardrail.
 */
export async function discoverGuardrails(
  deps: DiscoverGuardrailsDeps,
): Promise<DiscoveredGuardrail[]> {
  const { ctx, confluence } = deps;
  const log = logger("discovery");
  // No Confluence channel configured = honest gap (no guardrails discovered).
  if (!confluence.baseUrl || !confluence.token || !confluence.spaceKey) {
    const missing = [
      !confluence.baseUrl ? "baseUrl" : null,
      !confluence.token ? "token" : null,
      !confluence.spaceKey ? "spaceKey (CONFLUENCE_SECURITY_SPACE_KEY)" : null,
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

  const listed = await listSpacePages(ctx, baseUrl, authorization, confluence.spaceKey);
  if (!listed.ok) {
    log.warn(
      { spaceKey: confluence.spaceKey, status: listed.status, err: listed.err },
      listed.status === undefined
        ? `guardrail space listing failed for space ${confluence.spaceKey} — 0 guardrails discovered`
        : `guardrail space listing returned ${listed.status} for space ${confluence.spaceKey} — 0 guardrails discovered`,
    );
    return [];
  }
  const pages = listed.pages;

  const discovered = await Promise.all(
    pages.map(async ({ title, pageId }): Promise<DiscoveredGuardrail | null> => {
      const fetched = await fetchConfluenceStorageHtml(ctx, config, pageId);
      if (!fetched.ok) {
        return null; // unreadable page → drop (honest gap), never a fake guardrail
      }
      return {
        slug: slugify(title),
        name: title,
        pageId,
        headings: parseStorageHeadings(fetched.html),
      };
    }),
  );

  const guardrails = discovered.filter(
    (guardrail): guardrail is DiscoveredGuardrail => guardrail !== null,
  );
  log.info(
    { spaceKey: confluence.spaceKey, listed: pages.length, discovered: guardrails.length },
    `guardrail discovery: ${guardrails.length}/${pages.length} page(s) from space ${confluence.spaceKey}`,
  );
  return guardrails;
}

/** Collect the human text of every storage-HTML SECTION heading, in document
 *  order — the raw TOC. The page's `<h1>` is its title, not a section, so it is
 *  excluded (only `<h2>`–`<h6>` are bindable sections); each entry is still a
 *  heading the runtime section locator can resolve. */
function parseStorageHeadings(html: string): string[] {
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
 * Confluence v1 space-content response (the subset we read)                   */

type SpaceContentResult = { id?: string; title?: string; _links?: { webui?: string } };

type SpaceContentResponse = {
  results?: SpaceContentResult[];
  _links?: { next?: string; base?: string };
};
