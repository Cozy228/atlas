import type { Source } from "@atlas/schema";
import { parse, type HTMLElement } from "node-html-parser";
import type { ResolutionContext, ResolveResult, ResolverWarning } from "../resolvers/resolverTypes";

/**
 * Live, ACL-aware Confluence Cloud excerpt resolution.
 *
 * Locates a section by slugifying the binding's `heading` (a DEFAULT entry
 * point, not a fixed address) and scanning the live page's headings at request
 * time, fetched from the Confluence Cloud REST v2 API and threading the caller's
 * opaque Bearer token so Confluence's own ACL governs what comes back. Nothing is
 * persisted; the excerpt is ephemeral.
 *
 * Server / Data Center is out of scope — this is a Cloud-only adapter. A
 * Server adapter would implement the same `(request, config) => ResolveResult`
 * boundary against its own REST surface.
 * TODO(confluence-server): add a Server/Data Center adapter behind this seam.
 */
export type ConfluenceLiveConfig = {
  /** Personal API token (Basic, paired with email) or an opaque Bearer (no email). */
  token: string;
  /** Confluence site base URL, e.g. https://example.atlassian.net/wiki -> base. */
  baseUrl: string;
  /**
   * Atlassian account email. When set, auth is Confluence Cloud Basic
   * (email:token) — the scheme a personal API token requires; otherwise Bearer.
   */
  email?: string;
};

type ConfluenceLiveRequest = {
  source: Source;
  heading?: string;
  citationLabel?: string;
  ctx: ResolutionContext;
};

type ConfluencePageResponse = {
  title?: string;
  version?: { number?: number };
  body?: { storage?: { value?: string } };
  _links?: { webui?: string };
};

export async function resolveConfluencePageLive(
  request: ConfluenceLiveRequest,
  config: ConfluenceLiveConfig,
): Promise<ResolveResult> {
  // The heading is slugified into a runtime locator; an empty/missing heading
  // cannot address a section, so it surfaces as a broken anchor.
  const locator = request.heading ? slugify(request.heading) : undefined;

  if (!locator) {
    return brokenAnchor(
      request.source.id,
      undefined,
      "No section heading was supplied to locate in the live Confluence page.",
    );
  }

  const pageId = request.source.location;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  const loaded = await loadConfluencePage(request.ctx, config, pageId);
  if (!loaded.ok) {
    return warningResult({
      code: loaded.code,
      message: loaded.message,
      source_id: request.source.id,
      anchor_id: locator,
    });
  }

  // Locate the section by heading-slug scan on the page parsed ONCE per bundle.
  const sectionText = extractSectionFromRoot(loaded.root, locator);

  if (!sectionText) {
    return brokenAnchor(
      request.source.id,
      locator,
      "Section heading could not be resolved in the live Confluence page.",
    );
  }

  const warnings: ResolverWarning[] = [];
  const driftWarning = driftWarningFor(request.source, loaded.version, locator);
  if (driftWarning) {
    warnings.push(driftWarning);
  }

  return {
    excerpts: [
      {
        anchor_id: locator,
        text: sectionText,
        citation: {
          source_id: request.source.id,
          anchor_id: locator,
          label: request.citationLabel ?? request.heading ?? locator,
          location: buildCitationLocation(baseUrl, pageId, loaded.webui, locator),
        },
      },
    ],
    warnings,
  };
}

/**
 * A Confluence page fetched + JSON-decoded + structurally parsed ONCE. The
 * `root` HTMLElement is shared by every anchor on the page so the per-anchor
 * `parse(html)` cost collapses to one parse per page per bundle.
 */
type LoadedConfluencePage =
  | { ok: true; root: HTMLElement; version: number | undefined; webui: string | undefined }
  | { ok: false; code: "restricted_source" | "source_unavailable"; message: string };

/**
 * Memoize fetch + JSON + `parse(html)` for one page in the request-scoped
 * `ctx.pageCache`, keyed by the page's registry URL. The in-flight Promise is
 * stored BEFORE awaiting, so anchors resolving concurrently (plan 009) share a
 * single load (request-scoped single-flight). Without a `pageCache` (callers
 * that do not thread one) it is a straight fetch+parse — today's behaviour.
 *
 * Not `async` on purpose: the cache `set` must run synchronously at call time,
 * before the first `await` yields, so concurrent callers see the stored Promise.
 */
function loadConfluencePage(
  ctx: ResolutionContext,
  config: ConfluenceLiveConfig,
  pageId: string,
): Promise<LoadedConfluencePage> {
  const cache = ctx.pageCache;
  if (!cache) {
    return fetchAndParseConfluencePage(ctx, config, pageId);
  }
  const key = confluencePageUrl(config, pageId);
  const existing = cache.get(key) as Promise<LoadedConfluencePage> | undefined;
  if (existing) {
    return existing;
  }
  const promise = fetchAndParseConfluencePage(ctx, config, pageId);
  cache.set(key, promise);
  return promise;
}

async function fetchAndParseConfluencePage(
  ctx: ResolutionContext,
  config: ConfluenceLiveConfig,
  pageId: string,
): Promise<LoadedConfluencePage> {
  const fetched = await fetchConfluenceStorageHtml(ctx, config, pageId);
  if (!fetched.ok) {
    return { ok: false, code: fetched.code, message: fetched.message };
  }
  return {
    ok: true,
    root: parse(fetched.html),
    version: fetched.version,
    webui: fetched.webui,
  };
}

/** The v2 storage URL a page is fetched from — also its `pageCache` key. */
function confluencePageUrl(config: ConfluenceLiveConfig, pageId: string): string {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  return `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;
}

/**
 * Fetch a Confluence page's storage-format body through the shared channel
 * (same v2 endpoint, auth, and `ctx.fetch` — so caching and the caller's ACL
 * apply identically). Reused by both the anchor resolver and the release-notes
 * runtime. Maps HTTP status to the warning code/message the callers surface.
 */
export type ConfluenceFetchResult =
  | { ok: true; html: string; version: number | undefined; webui: string | undefined }
  | { ok: false; code: "restricted_source" | "source_unavailable"; message: string };

export async function fetchConfluenceStorageHtml(
  ctx: ResolutionContext,
  config: ConfluenceLiveConfig,
  pageId: string,
): Promise<ConfluenceFetchResult> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;

  let response: Awaited<ReturnType<typeof ctx.fetch>>;
  try {
    response = await ctx.fetch(url, {
      method: "GET",
      headers: {
        Authorization: confluenceAuthorization(config),
        Accept: "application/json",
      },
    });
  } catch {
    // Transport-level failure (DNS, timeout, connection reset). Degrade by
    // contract; the message stays generic so no URL/token can leak.
    return {
      ok: false,
      code: "source_unavailable",
      message: "Confluence could not be reached at request time.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      code: "restricted_source",
      message: "Confluence denied access to this source for the supplied identity.",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      code: "source_unavailable",
      message: "Confluence page was not found at request time.",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "source_unavailable",
      message: "Confluence page could not be resolved at request time.",
    };
  }

  let page: ConfluencePageResponse;
  try {
    page = (await response.json()) as ConfluencePageResponse;
  } catch {
    // Truncated/malformed body. Same generic degradation as a transport failure.
    return {
      ok: false,
      code: "source_unavailable",
      message: "Confluence returned an unreadable response.",
    };
  }
  return {
    ok: true,
    html: page.body?.storage?.value ?? "",
    version: page.version?.number,
    webui: page._links?.webui,
  };
}

/**
 * Confluence Cloud auth scheme. A personal API token authenticates with Basic
 * (email:token); an OAuth/PAT-style credential uses Bearer. Email presence
 * (CONFLUENCE_EMAIL) selects Basic. Exported so the reference-discovery
 * CQL adapter authenticates identically to these v2 content reads (plan 017).
 */
export function confluenceAuthorization(config: ConfluenceLiveConfig): string {
  if (config.email) {
    const basic = Buffer.from(`${config.email}:${config.token}`).toString("base64");
    return `Basic ${basic}`;
  }
  return `Bearer ${config.token}`;
}

function driftWarningFor(
  source: Source,
  liveVersion: number | undefined,
  anchorId: string,
): ResolverWarning | undefined {
  if (
    source.observed_version === undefined ||
    liveVersion === undefined ||
    liveVersion <= source.observed_version
  ) {
    return undefined;
  }
  return {
    code: "stale_source",
    message: "Source has changed since registration.",
    source_id: source.id,
    anchor_id: anchorId,
  };
}

function buildCitationLocation(
  baseUrl: string,
  pageId: string,
  webui: string | undefined,
  locator: string,
): string {
  const page = webui ? `${baseUrl}${webui}` : `${baseUrl}/wiki/pages/${encodeURIComponent(pageId)}`;
  return `${page}#${locator}`;
}

/**
 * Find the heading whose slugified text matches the locator and collect the
 * following sibling content until the next heading. Tolerant of Confluence
 * `<ac:*>` storage tags because node-html-parser does not enforce HTML rules.
 * Operates on the page parsed ONCE in `loadConfluencePage`; an empty/whitespace
 * body parses to a root with no headings, so it yields `undefined` as before.
 */
function extractSectionFromRoot(root: HTMLElement, locator: string): string | undefined {
  // The page's `<h1>` is its title, not a bindable section (same rule discovery
  // applies when it reads the TOC) — only `<h2>`–`<h6>` are locatable sections.
  // This also avoids a title/section slug collision (an `<h1>` and an `<h2>` whose
  // text slugifies identically): matching the title would collect no content (its
  // next sibling is the section heading) and falsely report a broken anchor.
  const headings = root.querySelectorAll("h2, h3, h4, h5, h6");
  const match = headings.find((heading) => slugify(heading.text) === locator);
  if (!match) {
    return undefined;
  }

  const parts: string[] = [];
  let node: HTMLElement | null = match.nextElementSibling;
  while (node && !isHeading(node)) {
    const text = node.text.trim();
    if (text) {
      parts.push(text);
    }
    node = node.nextElementSibling;
  }

  const sectionText = parts.join("\n").trim();
  return sectionText.length > 0 ? sectionText : undefined;
}

function isHeading(node: HTMLElement): boolean {
  return /^h[1-6]$/i.test(node.rawTagName ?? "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function brokenAnchor(
  sourceId: string,
  anchorId: string | undefined,
  message: string,
): ResolveResult {
  return warningResult({
    code: "broken_anchor",
    message,
    source_id: sourceId,
    anchor_id: anchorId,
  });
}

function warningResult(warning: ResolverWarning): ResolveResult {
  return { excerpts: [], warnings: [warning] };
}
