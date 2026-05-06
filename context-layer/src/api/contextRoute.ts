import {
  ContextRequestSchema,
  type ApiErrorResponse,
  type ContextBundleResponse,
  type ContextRequest,
} from "@atlas/schema";
import {
  buildContextBundle,
  createDefaultContextBundleService,
} from "../services/contextBundleService.js";
import type { ApiResponse } from "./routeTypes.js";
import { errorResponse } from "./routeTypes.js";

export function handleContextRequest(
  input: unknown,
): ApiResponse<ApiErrorResponse | ContextBundleResponse> {
  const parsed = ContextRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Context request is invalid.");
  }

  const service = createDefaultContextBundleService();
  const explicitError = validateExplicitRequest(service, parsed.data);
  if (explicitError) {
    return explicitError;
  }

  return {
    status: 200,
    body: buildContextBundle(service, parsed.data),
  };
}

function validateExplicitRequest(
  service: ReturnType<typeof createDefaultContextBundleService>,
  request: ContextRequest,
): ApiResponse<ApiErrorResponse> | undefined {
  if (request.topic_id && !service.registry.topics.getById(request.topic_id)) {
    return errorResponse(404, "topic_not_found", "Topic was not found in the Atlas registry.");
  }

  if (!request.source_id) {
    return undefined;
  }

  const source = service.registry.sources.getById(request.source_id);
  if (!source) {
    return errorResponse(404, "source_not_found", "Source was not found in the Atlas registry.");
  }

  if (source.visibility === "restricted") {
    return errorResponse(403, "access_denied", "Source is registered but access is restricted.");
  }

  const resolver = service.resolvers.get(source.source_class);
  const resolved = resolver?.resolve({
    source,
    anchors: service.registry.anchors.findBySourceId(source.id),
    anchorId: request.anchor_id,
    contentProvider: service.contentProvider,
  });
  const firstWarning = resolved?.warnings[0];

  if (firstWarning?.code === "broken_anchor") {
    return errorResponse(422, "anchor_broken", "Requested anchor could not be resolved.");
  }
  if (firstWarning?.code === "source_unavailable") {
    return errorResponse(503, "source_unavailable", "Requested source is unavailable.");
  }

  return undefined;
}
