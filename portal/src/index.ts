// Public package barrel: only non-JSX exports for cross-package consumers
// (e.g. @atlas/acceptance). React/TanStack Start surface is consumed inside
// the portal app via the Vite entry, not as a library export.
export { portalFramework } from "./framework";
export {
  askAtlas,
  buildAskAtlasPrompt,
  createDailyRateLimiter,
  validateCitations,
  type LlmAdapter,
} from "./ask/askAtlas";
export {
  listGuidance,
  getGuidance,
  relatedGuidanceForResource,
  type Guidance,
} from "./lib/guidance";
export { loadGuidance } from "./lib/loadGuidance";
