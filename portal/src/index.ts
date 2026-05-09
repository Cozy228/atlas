// Public package barrel: only non-JSX exports for cross-package consumers
// (e.g. @atlas/acceptance). React/TanStack Start surface is consumed inside
// the portal app via the Vite entry, not as a library export.
export { portalFramework } from "./framework.js";
export {
  askAtlas,
  buildAskAtlasPrompt,
  createDailyRateLimiter,
  validateCitations,
  type LlmAdapter,
} from "./ask/askAtlas.js";
export {
  buildFeedbackPayload,
  renderCapabilityDetail,
  renderLandingZoneNavigator,
  renderPortalHome,
  renderSourceLookup,
} from "./views/portalViews.js";
export { createStaticContextApiClient, type ContextApiClient } from "./api/contextApiClient.js";
