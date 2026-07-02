import type { AnchorResolver, ResolveResult } from "./resolverTypes";
import { logger } from "../observability/logging";
import {
  resolveTerraformModuleLive,
  resolveTerraformModuleFieldLive,
} from "../sourceContent/terraformModuleContentProvider";

export const terraformModuleResolver: AnchorResolver = {
  sourceClass: "terraform-module",
  async resolve(request) {
    // Single live path (plan 018 G2): the module is ALWAYS fetched from the
    // registry — dev/integration = MSW, prod = real network — never the in-memory
    // content provider. The caller's Bearer takes precedence (so the request
    // resolves under the caller's own TFC/TFE identity), else the service token;
    // baseUrl is deployment config, the public registry only the default.
    const env = readProcessEnv();
    const token = request.ctx.token ?? env.TERRAFORM_TOKEN;
    const baseUrl = env.TERRAFORM_BASE_URL ?? "https://registry.terraform.io";

    // No credential = honest gap, never a fabricated fallback. The single live
    // path cannot fetch without a token, so surface `source_unavailable` with
    // empty excerpts rather than reading an offline provider.
    if (!token) {
      return honestGap(request.source.id);
    }

    // Registry-metadata path (ADR-0010): a binding with `selector.field` cites a
    // module metadata field (version / input / output), a different kind of
    // content from README prose, resolved from the same live registry payload.
    if (request.selector?.field) {
      return resolveTerraformModuleFieldLive(request, { token, baseUrl });
    }

    // README-prose path (located by heading-slug scan).
    return resolveTerraformModuleLive(request, { token, baseUrl });
  },
};

/**
 * Honest gap when no registry credential is configured: the single live path
 * cannot fetch the module, so the section is surfaced as unavailable data —
 * never a fake fallback from an in-memory provider (plan 018).
 */
function honestGap(sourceId: string): ResolveResult {
  logger("resolve").warn(
    { sourceClass: "terraform-module", sourceId },
    "terraform resolve: no registry credential (ctx token / TERRAFORM_TOKEN both unset) — source unavailable, no fetch issued",
  );
  return {
    excerpts: [],
    warnings: [
      {
        code: "source_unavailable",
        message:
          "No Terraform registry credential is configured; the module cannot be resolved at request time.",
        source_id: sourceId,
      },
    ],
  };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
