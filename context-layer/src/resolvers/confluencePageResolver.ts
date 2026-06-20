import type { AnchorResolver } from "./resolverTypes.js";
import { resolveAnchor } from "./resolveAnchor.js";
import { resolveConfluencePageLive } from "../sourceContent/confluenceCloudContentProvider.js";

export const confluencePageResolver: AnchorResolver = {
  sourceClass: "confluence-page",
  async resolve(request) {
    // Live/offline branch lives here. Token order: caller's Bearer, else the
    // narrow-scoped service token, else defer to the offline pilot provider.
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
        return locator.length > 0 && !locator.startsWith("#");
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
