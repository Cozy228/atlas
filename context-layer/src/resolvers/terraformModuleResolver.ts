import type { AnchorResolver } from "./resolverTypes.js";
import { resolveAnchor } from "./resolveAnchor.js";

export const terraformModuleResolver: AnchorResolver = {
  sourceClass: "terraform-module",
  resolve(request) {
    return resolveAnchor({
      ...request,
      isValidLocator(locator) {
        return locator.startsWith("#");
      },
    });
  },
};
