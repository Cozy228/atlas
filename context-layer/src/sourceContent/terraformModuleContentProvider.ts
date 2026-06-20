import type { Anchor, Source } from "@atlas/schema";
import type {
  ResolutionContext,
  ResolveResult,
  ResolverWarning,
} from "../resolvers/resolverTypes.js";

/**
 * Live Terraform module excerpt resolution.
 *
 * Resolves a registered Anchor into an Excerpt by fetching the module's README
 * from its source of record at request time and extracting the section whose
 * heading matches the anchor locator. A module `location` is a GitHub repo
 * (e.g. `github.com/acme/terraform-aws-s3`), so this adapter targets GitHub's
 * "Get a repository README" API and decodes the base64 Markdown. Nothing is
 * persisted; the excerpt is ephemeral.
 *
 * Private Terraform Cloud / Enterprise registries are out of scope here; a
 * registry adapter would implement the same `(request, config) => ResolveResult`
 * boundary against the registry's module-docs surface.
 * TODO(terraform-registry): add a TFC/TFE registry adapter behind this seam.
 */
export type TerraformLiveConfig = {
  /** Service token (e.g. a GitHub PAT) sent as a Bearer credential. */
  token: string;
  /** API base URL; defaults to https://api.github.com (override for GHE). */
  baseUrl: string;
};

type TerraformLiveRequest = {
  source: Source;
  anchors: Anchor[];
  anchorId?: string;
  ctx: ResolutionContext;
};

type GitHubReadmeResponse = {
  content?: string;
  encoding?: string;
  html_url?: string;
};

export async function resolveTerraformModuleLive(
  request: TerraformLiveRequest,
  config: TerraformLiveConfig,
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

  const repo = parseRepo(request.source.location);
  if (!repo) {
    return warningResult({
      code: "source_unavailable",
      message: "Terraform module location is not a recognized repository.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/repos/${repo.owner}/${repo.name}/readme`;

  const response = await request.ctx.fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return warningResult({
      code: "restricted_source",
      message: "The module host denied access to this source for the supplied identity.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }
  if (response.status === 404) {
    return warningResult({
      code: "source_unavailable",
      message: "Module README was not found at request time.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }
  if (!response.ok) {
    return warningResult({
      code: "source_unavailable",
      message: "Module README could not be resolved at request time.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const readme = (await response.json()) as GitHubReadmeResponse;
  const markdown = decodeContent(readme);
  const sectionText = extractSectionText(markdown, stripHash(locator));

  if (!sectionText) {
    return brokenAnchor(
      request.source.id,
      anchor.id,
      "Registered anchor heading could not be resolved in the live module README.",
    );
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
          location: `${readme.html_url ?? `https://${request.source.location}`}${locator}`,
        },
      },
    ],
    warnings: [],
  };
}

function parseRepo(location: string): { owner: string; name: string } | undefined {
  // Accept github.com/owner/repo or a full https URL of the same shape.
  const match = location
    .replace(/^https?:\/\//, "")
    .match(/^[^/]*github[^/]*\/([^/]+)\/([^/#?]+)/i);
  if (!match) {
    return undefined;
  }
  return { owner: match[1], name: match[2].replace(/\.git$/, "") };
}

function decodeContent(readme: GitHubReadmeResponse): string {
  if (!readme.content) {
    return "";
  }
  if (readme.encoding === "base64") {
    return Buffer.from(readme.content, "base64").toString("utf8");
  }
  return readme.content;
}

/**
 * Find the Markdown heading whose slugified text matches the locator and collect
 * the following lines until the next heading (fenced code blocks included).
 */
function extractSectionText(markdown: string, slug: string): string | undefined {
  if (!markdown.trim()) {
    return undefined;
  }
  const lines = markdown.split(/\r?\n/);
  const headingSlug = (line: string): string | undefined => {
    const match = line.match(/^#{1,6}\s+(.*)$/);
    return match ? slugify(match[1]) : undefined;
  };

  let index = lines.findIndex((line) => headingSlug(line) === slug);
  if (index === -1) {
    return undefined;
  }

  const parts: string[] = [];
  for (index += 1; index < lines.length; index += 1) {
    if (headingSlug(lines[index]) !== undefined) {
      break;
    }
    parts.push(lines[index]);
  }

  const sectionText = parts.join("\n").trim();
  return sectionText.length > 0 ? sectionText : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHash(locator: string): string {
  return locator.replace(/^#/, "");
}

function isValidLocator(locator: string): boolean {
  return locator.startsWith("#");
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
