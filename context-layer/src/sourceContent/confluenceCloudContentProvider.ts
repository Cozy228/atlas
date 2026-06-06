import type { Anchor, Source } from "@atlas/schema";
import { parse, type HTMLElement } from "node-html-parser";
import type {
  ResolutionContext,
  ResolveResult,
  ResolverWarning,
} from "../resolvers/resolverTypes.js";

/**
 * Live, ACL-aware Confluence Cloud excerpt resolution.
 *
 * Resolves a registered Anchor into an Excerpt by fetching the page from the
 * Confluence Cloud REST v2 API at request time, threading the caller's opaque
 * Bearer token so Confluence's own ACL governs what comes back. Nothing is
 * persisted; the excerpt is ephemeral.
 *
 * Server / Data Center is out of scope — this is a Cloud-only adapter. A
 * Server adapter would implement the same `(request, config) => ResolveResult`
 * boundary against its own REST surface.
 * TODO(confluence-server): add a Server/Data Center adapter behind this seam.
 */
export type ConfluenceLiveConfig = {
  /** Opaque Bearer token (caller's token, else narrow service-token fallback). */
  token: string;
  /** Confluence site base URL, e.g. https://example.atlassian.net/wiki -> base. */
  baseUrl: string;
};

type ConfluenceLiveRequest = {
  source: Source;
  anchors: Anchor[];
  anchorId?: string;
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
  const anchor = selectAnchor(request.anchors, request.anchorId);
  const locator = anchor ? selectorLocator(anchor) : undefined;

  if (!anchor || !locator || !isValidLocator(locator)) {
    return brokenAnchor(
      request.source.id,
      request.anchorId,
      "Requested anchor is not registered or has an invalid locator.",
    );
  }

  const pageId = request.source.location;
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`;

  const response = await request.ctx.fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return warningResult({
      code: "restricted_source",
      message: "Confluence denied access to this source for the supplied identity.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }
  if (response.status === 404) {
    return warningResult({
      code: "source_unavailable",
      message: "Confluence page was not found at request time.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }
  if (!response.ok) {
    return warningResult({
      code: "source_unavailable",
      message: "Confluence page could not be resolved at request time.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const page = (await response.json()) as ConfluencePageResponse;
  const html = page.body?.storage?.value ?? "";
  const sectionText = extractSectionText(html, locator);

  if (!sectionText) {
    return brokenAnchor(
      request.source.id,
      anchor.id,
      "Registered anchor heading could not be resolved in the live Confluence page.",
    );
  }

  const warnings: ResolverWarning[] = [];
  const driftWarning = driftWarningFor(request.source, page.version?.number, anchor.id);
  if (driftWarning) {
    warnings.push(driftWarning);
  }

  return {
    excerpts: [
      {
        anchor_id: anchor.id,
        text: sectionText,
        citation: {
          source_id: request.source.id,
          anchor_id: anchor.id,
          label: anchor.citation_label,
          location: buildCitationLocation(baseUrl, pageId, page._links?.webui, locator),
        },
      },
    ],
    warnings,
  };
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
 */
function extractSectionText(html: string, locator: string): string | undefined {
  if (!html.trim()) {
    return undefined;
  }
  const root = parse(html);
  const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
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

function isValidLocator(locator: string): boolean {
  return locator.length > 0 && !locator.startsWith("#");
}

function selectorLocator(anchor: Anchor): string | undefined {
  const locator = anchor.selector.locator;
  return typeof locator === "string" ? locator : undefined;
}

function selectAnchor(anchors: Anchor[], anchorId: string | undefined): Anchor | undefined {
  if (anchorId) {
    return anchors.find((anchor) => anchor.id === anchorId);
  }
  return anchors[0];
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
