export { handleAvailabilityRequest } from "./api/availabilityRoute";
export { handleFeedbackRequest } from "./api/feedbackRoute";
export { handleHttpRequest } from "./api/httpRoute";
export { handleSourceDiscoveryRequest } from "./api/sourceDiscoveryRoute";
export { handleSourceRequest } from "./api/sourceRoute";
export { handleTopicDiscoveryRequest } from "./api/topicDiscoveryRoute";
export { handleTopicRequest } from "./api/topicRoute";
export {
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
  type ResourceContextRouteParams,
} from "./api/resourceRoutes";
export { renderResourceMarkdown } from "./resources/renderResourceMarkdown";
export { listResourceCanonicalIds } from "./adapters/dev/loadResources";
export {
  getResourceContext,
  searchResources,
  InvalidResourceRequestError,
} from "./resources/resourceContextService";
export {
  getResourceKindDef,
  listResourceKinds,
  resourceKindRegistry,
  sectionIdsForKind,
  type ResourceKindDef,
  type SectionDef,
} from "./resources/resourceKindRegistry";
export { loadReleaseNotes } from "./adapters/dev/loadReleaseNotes";
export { loadAnnouncements } from "./adapters/dev/loadAnnouncements";
export type { Announcement } from "./adapters/dev/loadAnnouncements";
export { resolveReleaseNotes } from "./releaseNotes/resolveReleaseNotes";
export { cachedResolutionContext } from "./sourceContent/sourceContentCache";
export { resolveDataDir } from "./adapters/dev/dataDir";
export type { Release, ReleaseItem } from "./releaseNotes/parseReleaseNotes";
