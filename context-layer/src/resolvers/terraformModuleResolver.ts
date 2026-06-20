import type { AnchorResolver } from "./resolverTypes.js";
import { resolveAnchor } from "./resolveAnchor.js";
import { resolveTerraformModuleLive } from "../sourceContent/terraformModuleContentProvider.js";

export const terraformModuleResolver: AnchorResolver = {
  sourceClass: "terraform-module",
  async resolve(request) {
    // Live/offline branch. A configured service token (e.g. a GitHub PAT) fetches
    // the module README from its source of record at request time; otherwise defer
    // to the offline pilot provider. The default base URL targets github.com's API.
    const env = readProcessEnv();
    const token = env.ATLAS_TERRAFORM_TOKEN;
    const baseUrl = env.ATLAS_TERRAFORM_BASE_URL ?? "https://api.github.com";

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

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
