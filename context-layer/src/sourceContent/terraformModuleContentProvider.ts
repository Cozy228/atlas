import type { Anchor, Source } from "@atlas/schema";
import type { ResolutionContext, ResolveResult, ResolverWarning } from "../resolvers/resolverTypes";

/**
 * Live Terraform module excerpt resolution.
 *
 * Resolves a registered Anchor into an Excerpt by fetching the module's docs
 * from the TFC/TFE module registry at request time. A module `location` is a
 * host-less registry address (`<namespace>/<name>/<provider>`, e.g.
 * `example/s3/aws`); the registry host is deployment config (`config.baseUrl`),
 * not part of the source's identity. This adapter calls the registry's module
 * version endpoint and reads README markdown from `root.readme`. The same
 * payload backs `module-field` anchors (ADR-0010): version / inputs / outputs.
 * Nothing is persisted; the excerpt is ephemeral.
 *
 * GitHub-hosted modules are out of scope on this platform; a GitHub adapter
 * would implement the same `(request, config) => ResolveResult` boundary.
 */
export type TerraformLiveConfig = {
  /** Registry token (TFC/TFE team or user token) sent as a Bearer credential. */
  token: string;
  /**
   * Registry base URL — deployment config, never baked into a source location.
   * The public registry (https://registry.terraform.io) uses the `/v1/modules`
   * API; a TFC/TFE host (e.g. a private Terraform Enterprise install) uses its
   * `/api/registry/v1/modules` API.
   */
  baseUrl: string;
};

type TerraformLiveRequest = {
  source: Source;
  anchors: Anchor[];
  anchorId?: string;
  ctx: ResolutionContext;
};

type RegistryVariable = { name?: string; default?: string; description?: string };
type RegistryModuleResponse = {
  version?: string;
  root?: { readme?: string; inputs?: RegistryVariable[]; outputs?: RegistryVariable[] };
};

type ModuleAddress = { namespace: string; name: string; provider: string; version?: string };

/**
 * Fetch a module version's registry detail. Public registry => `/v1/modules`,
 * a TFC/TFE host => `/api/registry/v1/modules`. Maps HTTP status to a warning
 * code/message; the caller fills in source_id/anchor_id.
 */
async function fetchRegistryModule(
  ctx: ResolutionContext,
  config: TerraformLiveConfig,
  mod: ModuleAddress,
): Promise<
  { ok: true; body: RegistryModuleResponse } | { ok: false; code: ResolverWarning["code"]; message: string }
> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const apiRoot = /registry\.terraform\.io/.test(base)
    ? `${base}/v1/modules`
    : `${base}/api/registry/v1/modules`;
  const path = `${mod.namespace}/${mod.name}/${mod.provider}`;
  const url = `${apiRoot}/${path}${mod.version ? `/${mod.version}` : ""}`;

  const response = await ctx.fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      code: "restricted_source",
      message: "The module registry denied access to this source for the supplied identity.",
    };
  }
  if (response.status === 404) {
    return { ok: false, code: "source_unavailable", message: "Module was not found in the registry at request time." };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "source_unavailable",
      message: "Module could not be resolved from the registry at request time.",
    };
  }
  return { ok: true, body: (await response.json()) as RegistryModuleResponse };
}

/** README-prose anchors: the section of root.readme whose heading matches the locator. */
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

  const mod = parseModuleAddress(request.source.location);
  if (!mod) {
    return warningResult({
      code: "source_unavailable",
      message: "Terraform module location is not a recognized registry address.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const fetched = await fetchRegistryModule(request.ctx, config, mod);
  if (!fetched.ok) {
    return warningResult({
      code: fetched.code,
      message: fetched.message,
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const markdown = fetched.body.root?.readme ?? "";
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
          location: `${request.source.location}${locator}`,
        },
      },
    ],
    warnings: [],
  };
}

/** module-field anchors (ADR-0010): a metadata field from the same registry payload. */
export async function resolveTerraformModuleFieldLive(
  request: TerraformLiveRequest,
  config: TerraformLiveConfig,
  field: string | undefined,
): Promise<ResolveResult> {
  const anchor = selectAnchor(request.anchors, request.anchorId);
  if (!anchor) {
    return brokenAnchor(request.source.id, request.anchorId, "Requested anchor is not registered.");
  }
  if (!field) {
    return brokenAnchor(request.source.id, anchor.id, "Module metadata field is not registered.");
  }

  const mod = parseModuleAddress(request.source.location);
  if (!mod) {
    return warningResult({
      code: "source_unavailable",
      message: "Terraform module location is not a recognized registry address.",
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const fetched = await fetchRegistryModule(request.ctx, config, mod);
  if (!fetched.ok) {
    return warningResult({
      code: fetched.code,
      message: fetched.message,
      source_id: request.source.id,
      anchor_id: anchor.id,
    });
  }

  const value = fieldValue(fetched.body, field);
  if (!value) {
    return brokenAnchor(
      request.source.id,
      anchor.id,
      "Module metadata field is unavailable in the live registry response.",
    );
  }

  return {
    excerpts: [
      {
        anchor_id: anchor.id,
        text: value,
        citation: {
          source_id: request.source.id,
          anchor_id: anchor.id,
          label: anchor.citation_label,
          location: `${request.source.location}#${field}`,
        },
      },
    ],
    warnings: [],
  };
}

/** version | input:<name> | output:<name> from a registry module payload. */
function fieldValue(body: RegistryModuleResponse, field: string): string | undefined {
  if (field === "version") {
    return body.version;
  }
  const match = field.match(/^(input|output):(.+)$/);
  if (match) {
    const list = match[1] === "input" ? body.root?.inputs : body.root?.outputs;
    const found = list?.find((variable) => variable.name === match[2]);
    return found?.description || found?.default || found?.name;
  }
  return undefined;
}

/** Accept host-less <namespace>/<name>/<provider>; tolerate a leading host segment. */
function parseModuleAddress(location: string): ModuleAddress | undefined {
  const parts = location
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .split("/");
  if (parts.length === 3) {
    return { namespace: parts[0], name: parts[1], provider: parts[2] };
  }
  if (parts.length >= 4) {
    return { namespace: parts[1], name: parts[2], provider: parts[3] };
  }
  return undefined;
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
