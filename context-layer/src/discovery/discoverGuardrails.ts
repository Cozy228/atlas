/**
 * Guardrail discovery (plan 018 G5) — the security-policy analog of service
 * source discovery. Services come from the availability spine; guardrails are
 * discovered by crawling a dedicated security-policy Confluence SPACE: list every
 * page in the space (CQL `space = <KEY> AND type = page`), then fetch each page
 * and read its storage-HTML heading TOC. The descriptive half (which page exists
 * / its headings) lives here; the normative half (which heading backs which
 * section) is the kernel's `SECTION_RULES.guardrail`, applied in
 * `deriveGuardrails`.
 *
 * Single live path: the only fetch target is the Confluence source system (dev =
 * MSW, prod = real), reached through `ctx.fetch`. An unconfigured channel is an
 * honest-empty result (no guardrails), never a fabricated fallback.
 */
import { parse } from "node-html-parser";
import {
  confluenceAuthorization,
  fetchConfluenceStorageHtml,
} from "../sourceContent/confluenceCloudContentProvider";
import { logger, serializeError } from "../observability/logging";
import type { ResolutionContext } from "../resolvers/resolverTypes";

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
  const cql = `space = ${confluence.spaceKey} AND type = page`;
  const url = `${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}`;

  let listing: SpaceListingResponse;
  try {
    const response = await ctx.fetch(url, {
      method: "GET",
      headers: { Authorization: confluenceAuthorization(config), Accept: "application/json" },
    });
    if (!response.ok) {
      log.warn(
        { spaceKey: confluence.spaceKey, status: response.status },
        `guardrail space listing returned ${response.status} for space ${confluence.spaceKey} — 0 guardrails discovered`,
      );
      return [];
    }
    listing = (await response.json()) as SpaceListingResponse;
  } catch (error) {
    log.warn(
      { spaceKey: confluence.spaceKey, err: serializeError(error) },
      `guardrail space listing failed for space ${confluence.spaceKey} — 0 guardrails discovered`,
    );
    return [];
  }

  const pages = (listing.results ?? [])
    .map((result) => {
      const title = result.title ?? result.content?.title;
      const webui = result._links?.webui ?? result.content?._links?.webui;
      const pageId = webui?.match(/\/pages\/(\d+)/)?.[1];
      return title && pageId ? { title, pageId } : null;
    })
    .filter((page): page is { title: string; pageId: string } => page !== null);

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
 * Confluence CQL v1 search response (the subset we read for space listing)    */

type SpaceListingResult = {
  title?: string;
  _links?: { webui?: string };
  content?: { title?: string; _links?: { webui?: string } };
};

type SpaceListingResponse = { results?: SpaceListingResult[] };
