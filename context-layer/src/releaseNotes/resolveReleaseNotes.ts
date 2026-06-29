import { parse, type HTMLElement } from "node-html-parser";

import {
  fetchConfluenceStorageHtml,
  type ConfluenceLiveConfig,
} from "../sourceContent/confluenceCloudContentProvider";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { parseReleaseNotes, type Release } from "./parseReleaseNotes";
import { parseAnnouncements, type Announcement } from "./parseAnnouncements";

export type { Release } from "./parseReleaseNotes";
export type { Announcement } from "./parseAnnouncements";

/**
 * Runtime resolution of the federated-platform **release-notes Confluence page**.
 *
 * Goes through the *same* Confluence channel as anchor resolution
 * (`fetchConfluenceStorageHtml` — same endpoint, auth, `ctx.fetch` cache, and
 * caller ACL), then renders the storage HTML to text and parses it
 * ({@link parseReleaseNotes}). Not a CLI: this runs in-process.
 *
 * The page id comes from `ATLAS_RELEASE_NOTES_PAGE_ID`, read lazily (per call,
 * not at import) so a runtime that sets the env after this module loads — dev
 * MSW, integration tests, ops — is always honoured.
 */
export function releaseNotesPageId(): string {
  return readEnv().ATLAS_RELEASE_NOTES_PAGE_ID ?? "CONFIGURE_RELEASE_NOTES_PAGE_ID";
}

export type ReleaseNotesResult =
  | { ok: true; releases: Release[]; announcements: Announcement[] }
  | {
      ok: false;
      code: "not_configured" | "restricted_source" | "source_unavailable";
      message: string;
    };

export async function resolveReleaseNotes(
  ctx: ResolutionContext,
  config: Partial<ConfluenceLiveConfig> = confluenceConfigFromEnv(ctx),
  pageId: string = releaseNotesPageId(),
): Promise<ReleaseNotesResult> {
  if (!config.token || !config.baseUrl || pageId === "CONFIGURE_RELEASE_NOTES_PAGE_ID") {
    return {
      ok: false,
      code: "not_configured",
      message:
        "Release notes need ATLAS_CONFLUENCE_BASE_URL, a token, and a configured page id (RELEASE_NOTES_PAGE_ID).",
    };
  }

  const fetched = await fetchConfluenceStorageHtml(
    ctx,
    { token: config.token, baseUrl: config.baseUrl, email: config.email },
    pageId,
  );
  if (!fetched.ok) {
    return fetched;
  }

  // One render, two parses: formal releases and standalone announcements both
  // come off the single "What's New" page.
  const text = renderStorageHtml(fetched.html);
  return {
    ok: true,
    releases: parseReleaseNotes(text),
    announcements: parseAnnouncements(text),
  };
}

/**
 * Render Confluence storage HTML to the line format the parsers expect:
 * headings/paragraphs as their own lines, ordered-list items numbered,
 * unordered-list items bulleted. Anchor hrefs are preserved inline as
 * `"<label> (<href>)"` so the announcement parser can recover a call-to-action
 * link the agent/UI follows (releases never carry inline links, so this is inert
 * for the release path).
 *
 * ponytail: covers the common storage elements (h1-6 / p / ol / ul). If the
 * real page nests scope differently, tune this walk — the parsers downstream are
 * unchanged.
 */
export function renderStorageHtml(html: string): string {
  const root = parse(html);
  const lines: string[] = [];

  const walk = (node: HTMLElement): void => {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) {
        continue;
      }
      const element = child as HTMLElement;
      const tag = (element.rawTagName ?? "").toLowerCase();

      if (tag === "ol") {
        element.querySelectorAll("li").forEach((li, index) => {
          lines.push(`${index + 1}. ${collapse(li.text)}`);
        });
      } else if (tag === "ul") {
        element.querySelectorAll("li").forEach((li) => {
          lines.push(`• ${collapse(li.text)}`);
        });
      } else if (/^h[1-6]$/.test(tag) || tag === "p") {
        const text = renderInline(element);
        if (text) {
          lines.push(text);
        }
      } else {
        walk(element);
      }
    }
  };

  walk(root);
  return lines.join("\n");
}

/**
 * Flatten an element's inline content to one line, preserving anchor hrefs as
 * `"<label> (<href>)"`. An element with no anchors yields exactly `collapse(text)`.
 */
function renderInline(element: HTMLElement): string {
  const parts: string[] = [];
  for (const child of element.childNodes) {
    if (child.nodeType === 3) {
      parts.push((child as HTMLElement).text);
      continue;
    }
    if (child.nodeType !== 1) {
      continue;
    }
    const el = child as HTMLElement;
    if ((el.rawTagName ?? "").toLowerCase() === "a") {
      const href = el.getAttribute("href");
      parts.push(href ? `${el.text} (${href})` : el.text);
    } else {
      parts.push(renderInline(el));
    }
  }
  return collapse(parts.join(""));
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Mirror the Confluence resolver: caller Bearer first, else the service token. */
function confluenceConfigFromEnv(ctx: ResolutionContext): Partial<ConfluenceLiveConfig> {
  const env = readEnv();
  return {
    token: ctx.token ?? env.ATLAS_CONFLUENCE_TOKEN,
    baseUrl: env.ATLAS_CONFLUENCE_BASE_URL,
    email: env.ATLAS_CONFLUENCE_EMAIL,
  };
}

function readEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
