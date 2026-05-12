import type { AnchorResolver } from "./resolverTypes.js";
import { resolveAnchor } from "./resolveAnchor.js";

export const confluencePageResolver: AnchorResolver = {
  sourceClass: "confluence-page",
  resolve(request) {
    return resolveAnchor({
      ...request,
      isValidLocator(locator) {
        return locator.length > 0 && !locator.startsWith("#");
      },
    });
  },
};
