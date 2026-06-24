import { parse, type HTMLElement } from "node-html-parser";

import {
  fetchConfluenceStorageHtml,
  type ConfluenceLiveConfig,
} from "../sourceContent/confluenceCloudContentProvider.js";
import type { ResolutionContext } from "../resolvers/resolverTypes.js";
import { parseReleaseNotes, type Release } from "./parseReleaseNotes.js";

/**
 * Runtime resolution of the federated-platform **release-notes Confluence page**.
 *
 * Goes through the *same* Confluence channel as anchor resolution
 * (`fetchConfluenceStorageHtml` — same endpoint, auth, `ctx.fetch` cache, and
 * caller ACL), then renders the storage HTML to text and parses it
 * ({@link parseReleaseNotes}). Not a CLI: this runs in-process.
 *
 * The page address is configured in code below (env override for ops).
 */
export const RELEASE_NOTES_PAGE_ID =
  readEnv().ATLAS_RELEASE_NOTES_PAGE_ID ?? "CONFIGURE_RELEASE_NOTES_PAGE_ID";

export type ReleaseNotesResult =
  | { ok: true; release: Release }
  | {
      ok: false;
      code: "not_configured" | "restricted_source" | "source_unavailable";
      message: string;
    };

export async function resolveReleaseNotes(
  ctx: ResolutionContext,
  config: Partial<ConfluenceLiveConfig> = confluenceConfigFromEnv(ctx),
  pageId: string = RELEASE_NOTES_PAGE_ID,
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

  return { ok: true, release: parseReleaseNotes(renderStorageHtml(fetched.html)) };
}

/**
 * Render Confluence storage HTML to the line format {@link parseReleaseNotes}
 * expects: headings/paragraphs as their own lines, ordered-list items numbered,
 * unordered-list items bulleted.
 *
 * ponytail: covers the common storage elements (h1-6 / p / ol / ul). If the
 * real page nests scope differently, tune this walk — the parser downstream is
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
        const text = collapse(element.text);
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
