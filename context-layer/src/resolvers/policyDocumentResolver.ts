import type { AnchorResolver } from "./resolverTypes.js";
import { resolveAnchor } from "./resolveAnchor.js";

export const policyDocumentResolver: AnchorResolver = {
  sourceClass: "policy-document",
  resolve(request) {
    return resolveAnchor({
      ...request,
      isValidLocator(locator) {
        return locator.startsWith("clause-");
      },
    });
  },
};
