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
import {
  offlineResolutionContext,
  type ResolutionContext,
} from "../resolvers/resolverTypes.js";
import type { ApiResponse } from "./routeTypes.js";
import { errorResponse } from "./routeTypes.js";

export async function handleContextRequest(
  input: unknown,
  ctx: ResolutionContext = offlineResolutionContext(),
): Promise<ApiResponse<ApiErrorResponse | ContextBundleResponse>> {
  const parsed = ContextRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Context request is invalid.");
  }

  const service = createDefaultContextBundleService();
  const explicitError = validateExplicitRequest(service, parsed.data);
  if (explicitError) {
    return explicitError;
  }

  const bundle = await buildContextBundle(service, parsed.data, ctx);

  // A single Confluence call happens during the build above. For an explicit
  // source request we promote the resulting runtime warnings into HTTP errors
  // here, so an explicit request never triggers a second resolve.
  const promoted = promoteExplicitSourceWarning(parsed.data, bundle);
  if (promoted) {
    return promoted;
  }

  return {
    status: 200,
    body: bundle,
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

  // Static, registry-declared restriction is known without calling Confluence.
  if (source.visibility === "restricted") {
    return errorResponse(403, "access_denied", "Source is registered but access is restricted.");
  }

  return undefined;
}

/**
 * For an explicit `source_id` request, scan the built bundle's warnings and
 * promote the runtime ACL / availability / anchor outcomes into HTTP errors.
 * This reuses the single resolve already performed by `buildContextBundle`.
 */
function promoteExplicitSourceWarning(
  request: ContextRequest,
  bundle: ContextBundleResponse,
): ApiResponse<ApiErrorResponse> | undefined {
  if (!request.source_id) {
    return undefined;
  }

  const codes = new Set(
    bundle.warnings
      .filter((warning) => !warning.source_id || warning.source_id === request.source_id)
      .map((warning) => warning.code),
  );

  if (codes.has("restricted_source")) {
    return errorResponse(403, "access_denied", "Source is registered but access is restricted.");
  }
  if (codes.has("broken_anchor")) {
    return errorResponse(422, "anchor_broken", "Requested anchor could not be resolved.");
  }
  if (codes.has("source_unavailable")) {
    return errorResponse(503, "source_unavailable", "Requested source is unavailable.");
  }

  return undefined;
}
