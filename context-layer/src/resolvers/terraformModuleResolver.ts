import type { Anchor } from "@atlas/schema";
import type { AnchorResolver, ResolveRequest, ResolveResult } from "./resolverTypes";
import { resolveAnchor } from "./resolveAnchor";
import {
  resolveTerraformModuleLive,
  resolveTerraformModuleFieldLive,
} from "../sourceContent/terraformModuleContentProvider";

export const terraformModuleResolver: AnchorResolver = {
  sourceClass: "terraform-module",
  async resolve(request) {
    const anchor = pickAnchor(request.anchors, request.anchorId);

    // Token order mirrors Confluence: the caller's Bearer first (so the request
    // resolves under the caller's own TFC/TFE identity), else the service token,
    // else defer to the offline pilot provider. baseUrl is the registry host
    // (deployment config); the public registry is only the default placeholder.
    const env = readProcessEnv();
    const token = request.ctx.token ?? env.ATLAS_TERRAFORM_TOKEN;
    const baseUrl = env.ATLAS_TERRAFORM_BASE_URL ?? "https://registry.terraform.io";

    // Registry-metadata path (ADR-0010): a `module-field` anchor cites a module
    // metadata field (version / input / output), a different kind of content from
    // the README prose. Live registry when a token is configured; else the
    // governed offline metadata map.
    if (anchor?.anchor_strategy === "module-field") {
      if (token) {
        return resolveTerraformModuleFieldLive(request, { token, baseUrl }, stringSelector(anchor, "field"));
      }
      return resolveModuleField(request, anchor);
    }

    // README-prose path.
    if (token) {
      return resolveTerraformModuleLive(request, { token, baseUrl });
    }

    return resolveAnchor({
      ...request,
      isValidLocator(locator) {
        return locator.startsWith("#");
      },
    });
  },
};

/**
 * Resolve a module registry-metadata field from the governed metadata map
 * (keys are `field:<name>`). Offline today; the live registry adapter replaces
 * the lookup behind this same function without changing the citation shape.
 */
function resolveModuleField(request: ResolveRequest, anchor: Anchor): ResolveResult {
  const field = stringSelector(anchor, "field");
  const value = field
    ? request.contentProvider.getSourceContent(request.source.id)?.[`field:${field}`]
    : undefined;

  if (!field || !value) {
    return {
      excerpts: [],
      warnings: [
        {
          code: "broken_anchor",
          message: "Module metadata field is not registered or unavailable.",
          source_id: request.source.id,
          anchor_id: anchor.id,
        },
      ],
    };
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

function pickAnchor(anchors: Anchor[], anchorId: string | undefined): Anchor | undefined {
  if (anchorId) {
    return anchors.find((anchor) => anchor.id === anchorId);
  }
  return anchors[0];
}

function stringSelector(anchor: Anchor, key: string): string | undefined {
  const value = anchor.selector[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
