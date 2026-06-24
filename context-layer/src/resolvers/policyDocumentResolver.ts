import type { AnchorResolver } from "./resolverTypes";
import { resolveAnchor } from "./resolveAnchor";
import { resolveConfluencePageLive } from "../sourceContent/confluenceCloudContentProvider";

export const policyDocumentResolver: AnchorResolver = {
  sourceClass: "policy-document",
  async resolve(request) {
    // Governance policies are published in Confluence too: when a Confluence
    // channel is configured, resolve the policy page live (caller's Bearer
    // first, else the service token) — same seam as the confluence-page
    // resolver. Without it, fall back to the offline pilot provider, which
    // serves the clause-anchored S3 markdown fixtures.
    const env = readProcessEnv();
    const token = request.ctx.token ?? env.ATLAS_CONFLUENCE_TOKEN;
    const baseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
    const email = env.ATLAS_CONFLUENCE_EMAIL;

    if (token && baseUrl) {
      return resolveConfluencePageLive(request, { token, baseUrl, email });
    }

    return resolveAnchor({
      ...request,
      isValidLocator(locator) {
        return locator.startsWith("clause-");
      },
    });
  },
};

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
