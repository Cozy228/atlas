export { handleAvailabilityRequest } from "./api/availabilityRoute";
export {
  handleAppRegistrationRequest,
  handleAppRequest,
  handleAppsListRequest,
  handleAppUpdateRequest,
} from "./api/appsRoutes";
export { handleFeedbackRequest } from "./api/feedbackRoute";
export {
  handleLocationRegistrationRequest,
  handleLocationsListRequest,
  handleLocationDeleteRequest,
} from "./api/locationsRoutes";
export { handleStatusRequest } from "./api/statusRoute";
export { handleChangesRequest, type ChangesRequestOptions } from "./api/changesRoute";
export {
  refreshGraphSnapshots,
  type RefreshGraphSnapshotsOptions,
  type RefreshGraphSnapshotsResult,
} from "./graph/refreshGraphSnapshots";
export {
  API_DEFAULT_DEPTH,
  handleBriefRequest,
  renderBriefMarkdown,
  type BriefRequestOptions,
} from "./api/briefsRoute";
export { handleHttpRequest } from "./api/httpRoute";
export { handleSourceDiscoveryRequest } from "./api/sourceDiscoveryRoute";
export { handleSourceRequest } from "./api/sourceRoute";
export {
  handleResourceCatalogRequest,
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
  type ResourceContextRouteParams,
} from "./api/resourceRoutes";
export { renderResourceMarkdown } from "./resources/renderResourceMarkdown";
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
export {
  createResolutionContext,
  nullAppDirectoryAdapter,
  type AppDirectoryPort,
  type GovernedResolutionContext,
  type ScopeInput,
} from "./resolvers/createResolutionContext";
export type { ResolutionChannel } from "./resolvers/resolverTypes";
export { handleInstrumentsRequest, handleVerifyBeacon } from "./api/instrumentsRoute";
// A curated instruments surface — the record*/estimate/snapshot set only. The
// raw registry ops (`incrementCounter`/`observeHistogram`) and the test-only
// `resetMetrics` stay module-private (context-layer tests import them directly).
import {
  estimateTokens as estimateTokensImpl,
  recordBriefAssembled as recordBriefAssembledImpl,
  recordBriefCall as recordBriefCallImpl,
  recordBriefPayload as recordBriefPayloadImpl,
  recordCitationFollow as recordCitationFollowImpl,
  snapshot as snapshotImpl,
} from "./observability/metrics";
export const instrumentsMetrics = {
  recordBriefAssembled: recordBriefAssembledImpl,
  recordBriefCall: recordBriefCallImpl,
  recordBriefPayload: recordBriefPayloadImpl,
  recordCitationFollow: recordCitationFollowImpl,
  estimateTokens: estimateTokensImpl,
  snapshot: snapshotImpl,
};
export { type AppsRepository } from "./repositories/appsRepository";
export { createAppsRepository, sharedAppsRepository } from "./repositories/appsRepositoryFactory";
export { createSelfDeclaredAppsAdapter } from "./repositories/selfDeclaredAppsAdapter";
export { type LocationsRepository } from "./repositories/locationsRepository";
export {
  createLocationsRepository,
  sharedLocationsRepository,
} from "./repositories/locationsRepositoryFactory";
export {
  adapterAuthModes,
  composeValueUrl,
  resolveStatusAdapter,
  type AdapterAuthMode,
  type StatusAdapter,
  type StatusAdapterContext,
} from "./locations/statusAdapter";
export { createTfeStatusAdapter } from "./locations/tfeStatusAdapter";
export { deriveLocationIndex, type LocationIndexInput } from "./locations/locationIndex";
export { assembleStatusBoard, type StatusBoardDeps } from "./status/statusBoard";
export { assembleDebugFloor, type DebugFloorInput } from "./briefs/debugFloor";
export { type EventsRepository } from "./repositories/eventsRepository";
export {
  createEventsRepository,
  sharedEventsRepository,
} from "./repositories/eventsRepositoryFactory";
export { LANDING_ZONES } from "./landingZones";
export { resolveReleaseNotes } from "./releaseNotes/resolveReleaseNotes";
export { loadConfluenceGuidance } from "./composition";
export type { Announcement } from "./releaseNotes/parseAnnouncements";
export { logger, serializeError, errorSummary } from "./observability/logging";
export type { Release, ReleaseItem } from "./releaseNotes/parseReleaseNotes";
