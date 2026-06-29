import type { AnchorResolver, ResolveResult } from "./resolverTypes";
import { resolveConfluencePageLive } from "../sourceContent/confluenceCloudContentProvider";

export const confluencePageResolver: AnchorResolver = {
  sourceClass: "confluence-page",
  async resolve(request) {
    // Single live path (plan 018): the page is ALWAYS fetched from Confluence
    // Cloud — dev/integration = MSW, prod = real — never an in-memory provider.
    // Token order: the caller's Bearer first (so the page resolves under the
    // caller's own ACL), else the narrow-scoped service token.
    const env = readProcessEnv();
    const token = request.ctx.token ?? env.ATLAS_CONFLUENCE_TOKEN;
    const baseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
    const email = env.ATLAS_CONFLUENCE_EMAIL;

    // No Confluence channel configured = honest gap, never a fabricated fallback.
    if (!token || !baseUrl) {
      return honestGap(request.source.id);
    }

    return resolveConfluencePageLive(request, { token, baseUrl, email });
  },
};

/**
 * Honest gap when no Confluence channel is configured: the single live path
 * cannot fetch the page, so the section is surfaced as unavailable data — never a
 * fake fallback from an in-memory provider (plan 018).
 */
function honestGap(sourceId: string): ResolveResult {
  return {
    excerpts: [],
    warnings: [
      {
        code: "source_unavailable",
        message:
          "No Confluence channel is configured; the page cannot be resolved at request time.",
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
