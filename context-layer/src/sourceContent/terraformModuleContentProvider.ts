import type { Source } from "@atlas/schema";
import type { ResolutionContext, ResolveResult, ResolverWarning } from "../resolvers/resolverTypes";

/**
 * Live Terraform module excerpt resolution.
 *
 * Locates a README section by slugifying the binding's `heading` (a DEFAULT
 * entry point) and scanning the module's docs, fetched from the TFC/TFE module
 * registry at request time. A module `location` is a host-less registry address
 * (`<namespace>/<name>/<provider>`, e.g. `example/s3/aws`); the registry host is
 * deployment config (`config.baseUrl`), not part of the source's identity. This
 * adapter calls the registry's module version endpoint and reads README markdown
 * from `root.readme`. The same payload backs module-metadata fields located by a
 * `selector.field` (ADR-0010): version / inputs / outputs. Nothing is persisted;
 * the excerpt is ephemeral.
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
  heading?: string;
  selector?: Record<string, string>;
  citationLabel?: string;
  ctx: ResolutionContext;
};

type RegistryVariable = { name?: string; default?: string; description?: string };
type RegistryModuleResponse = {
  version?: string;
  root?: { readme?: string; inputs?: RegistryVariable[]; outputs?: RegistryVariable[] };
};

type ModuleAddress = { namespace: string; name: string; provider: string; version?: string };

type FetchRegistryModuleResult =
  | { ok: true; body: RegistryModuleResponse }
  | { ok: false; code: ResolverWarning["code"]; message: string };

/** The registry detail URL for a module address — also its `pageCache` key. */
function registryModuleUrl(config: TerraformLiveConfig, mod: ModuleAddress): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  const apiRoot = /registry\.terraform\.io/.test(base)
    ? `${base}/v1/modules`
    : `${base}/api/registry/v1/modules`;
  const path = `${mod.namespace}/${mod.name}/${mod.provider}`;
  return `${apiRoot}/${path}${mod.version ? `/${mod.version}` : ""}`;
}

/**
 * Memoize a module's registry detail (fetch + JSON body) in the request-scoped
 * `ctx.pageCache`, keyed by the registry URL. The README anchor and every
 * `module-field` anchor on a module hit the SAME URL, so they share ONE fetch
 * per module per bundle. The in-flight Promise is stored BEFORE awaiting, so
 * anchors resolving concurrently (plan 009) share a single load. Without a
 * `pageCache` it is a straight fetch — today's per-anchor behaviour.
 *
 * Not `async` on purpose: the cache `set` must run synchronously at call time,
 * before the first `await` yields, so concurrent callers see the stored Promise.
 */
function loadRegistryModule(
  ctx: ResolutionContext,
  config: TerraformLiveConfig,
  mod: ModuleAddress,
): Promise<FetchRegistryModuleResult> {
  const cache = ctx.pageCache;
  if (!cache) {
    return fetchRegistryModule(ctx, config, mod);
  }
  const key = registryModuleUrl(config, mod);
  const existing = cache.get(key) as Promise<FetchRegistryModuleResult> | undefined;
  if (existing) {
    return existing;
  }
  const promise = fetchRegistryModule(ctx, config, mod);
  cache.set(key, promise);
  return promise;
}

/**
 * Fetch a module version's registry detail. Public registry => `/v1/modules`,
 * a TFC/TFE host => `/api/registry/v1/modules`. Maps HTTP status to a warning
 * code/message; the caller fills in source_id/anchor_id.
 */
async function fetchRegistryModule(
  ctx: ResolutionContext,
  config: TerraformLiveConfig,
  mod: ModuleAddress,
): Promise<FetchRegistryModuleResult> {
  const url = registryModuleUrl(config, mod);

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
    return {
      ok: false,
      code: "source_unavailable",
      message: "Module was not found in the registry at request time.",
    };
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

/**
 * Discovery byproduct (plan 018 G5): fetch a module's registry detail and return
 * its README plus the full ordered heading list (the raw TOC) — the free
 * byproduct of the same parse the section locator uses. The derivation engine
 * uses the TOC to bind `network`/`examples` sections by heading-pattern default.
 * Returns `null` on a missing/unreadable module (404 / auth failure / any
 * non-2xx) so a module-less service derives an honest gap, never a fake section.
 */
export async function discoverTerraformModule(
  ctx: ResolutionContext,
  config: TerraformLiveConfig,
  address: string,
): Promise<{ readme: string; headings: string[]; version?: string } | null> {
  const mod = parseModuleAddress(address);
  if (!mod) {
    return null;
  }
  const fetched = await loadRegistryModule(ctx, config, mod);
  if (!fetched.ok) {
    return null;
  }
  const readme = fetched.body.root?.readme ?? "";
  return { readme, headings: parseReadmeHeadings(readme), version: fetched.body.version };
}

/** Collect the human text of every Markdown ATX heading, in document order — the
 *  raw TOC. Mirrors `extractSectionText`'s heading detection so the TOC entries
 *  are exactly the headings the runtime section locator can resolve. */
function parseReadmeHeadings(markdown: string): string[] {
  if (!markdown.trim()) {
    return [];
  }
  const headings: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const text = line.match(/^#{1,6}\s+(.*)$/)?.[1].trim();
    if (text) {
      headings.push(text);
    }
  }
  return headings;
}

/** README-prose: the section of root.readme whose heading slug matches the binding heading. */
export async function resolveTerraformModuleLive(
  request: TerraformLiveRequest,
  config: TerraformLiveConfig,
): Promise<ResolveResult> {
  // The heading is slugified into a runtime locator; an empty/missing heading
  // cannot address a section, so it surfaces as a broken anchor.
  const slug = request.heading ? slugify(request.heading) : undefined;

  if (!slug) {
    return brokenAnchor(
      request.source.id,
      undefined,
      "No section heading was supplied to locate in the live module README.",
    );
  }

  const mod = parseModuleAddress(request.source.location);
  if (!mod) {
    return warningResult({
      code: "source_unavailable",
      message: "Terraform module location is not a recognized registry address.",
      source_id: request.source.id,
      anchor_id: slug,
    });
  }

  const fetched = await loadRegistryModule(request.ctx, config, mod);
  if (!fetched.ok) {
    return warningResult({
      code: fetched.code,
      message: fetched.message,
      source_id: request.source.id,
      anchor_id: slug,
    });
  }

  const markdown = fetched.body.root?.readme ?? "";
  const sectionText = extractSectionText(markdown, slug);
  if (!sectionText) {
    return brokenAnchor(
      request.source.id,
      slug,
      "Section heading could not be resolved in the live module README.",
    );
  }

  return {
    excerpts: [
      {
        anchor_id: slug,
        text: sectionText,
        citation: {
          source_id: request.source.id,
          anchor_id: slug,
          label: request.citationLabel ?? request.heading ?? slug,
          location: `${request.source.location}#${slug}`,
        },
      },
    ],
    warnings: [],
  };
}

/** Module-metadata fields (ADR-0010): a field from the same registry payload,
 *  addressed by `selector.field` (version / input:<name> / output:<name>). */
export async function resolveTerraformModuleFieldLive(
  request: TerraformLiveRequest,
  config: TerraformLiveConfig,
): Promise<ResolveResult> {
  const field = request.selector?.field;
  if (!field) {
    return brokenAnchor(request.source.id, undefined, "No module metadata field was requested.");
  }

  const mod = parseModuleAddress(request.source.location);
  if (!mod) {
    return warningResult({
      code: "source_unavailable",
      message: "Terraform module location is not a recognized registry address.",
      source_id: request.source.id,
      anchor_id: field,
    });
  }

  const fetched = await loadRegistryModule(request.ctx, config, mod);
  if (!fetched.ok) {
    return warningResult({
      code: fetched.code,
      message: fetched.message,
      source_id: request.source.id,
      anchor_id: field,
    });
  }

  const value = fieldValue(fetched.body, field);
  if (!value) {
    return brokenAnchor(
      request.source.id,
      field,
      "Module metadata field is unavailable in the live registry response.",
    );
  }

  return {
    excerpts: [
      {
        anchor_id: field,
        text: value,
        citation: {
          source_id: request.source.id,
          anchor_id: field,
          label: request.citationLabel ?? field,
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
