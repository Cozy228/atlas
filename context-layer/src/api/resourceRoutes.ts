import type {
  ApiErrorResponse,
  ResourceContextResponse,
  ResourceKind,
  ResourceSearchResponse,
} from "@atlas/schema";
import { createDefaultContextBundleService } from "../services/contextBundleService";
import { getResourceKindDef } from "../resources/resourceKindRegistry";
import {
  getResourceContext,
  InvalidResourceRequestError,
  searchResources,
} from "../resources/resourceProjectionService";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { errorResponse, type ApiResponse } from "./routeTypes";

/**
 * Resource search (proposal §5.7): resolve a free-text name to canonical
 * `{kind}/{slug}` ids + URLs. It answers no questions — a missing/empty `query`
 * is a 400, an unmatched query is a 200 with an empty `items[]`.
 */
export function handleResourceSearchRequest(
  query: string | undefined,
  options: { baseUrl?: string } = {},
): ApiResponse<ResourceSearchResponse | ApiErrorResponse> {
  if (!query || query.trim().length === 0) {
    return errorResponse(400, "invalid_request", "searchResources requires a non-empty `query`.");
  }
  const service = createDefaultContextBundleService();
  return { status: 200, body: searchResources(service, query, { baseUrl: options.baseUrl }) };
}

export type ResourceContextRouteParams = {
  kind: string;
  slug: string;
  /** Comma-separated Section filter; omitted = every Section for the kind. */
  sections?: string;
  baseUrl?: string;
};

/**
 * Resource context projection (proposal §5.1–§5.6): live-resolve a known
 * resource's Sections. Unknown kind → 400; unknown resource → 404 (→
 * searchResources); unknown Section value → 400.
 */
export async function handleResourceContextRequest(
  params: ResourceContextRouteParams,
  ctx?: ResolutionContext,
): Promise<ApiResponse<ResourceContextResponse | ApiErrorResponse>> {
  if (!getResourceKindDef(params.kind)) {
    return errorResponse(
      400,
      "invalid_request",
      `Unknown resource kind '${params.kind}'. Valid kinds come from the OpenAPI 'kind' enum / searchResources results.`,
    );
  }

  const sections = parseSections(params.sections);
  const service = createDefaultContextBundleService();

  try {
    const response = await getResourceContext(
      service,
      { kind: params.kind as ResourceKind, slug: params.slug, sections, baseUrl: params.baseUrl },
      ctx,
    );
    if (!response) {
      return errorResponse(
        404,
        "resource_not_found",
        `No resource '${params.kind}/${params.slug}' is registered. Call searchResources to resolve the canonical id.`,
      );
    }
    return { status: 200, body: response };
  } catch (error) {
    if (error instanceof InvalidResourceRequestError) {
      return errorResponse(400, "invalid_request", error.message);
    }
    throw error;
  }
}

function parseSections(sections: string | undefined): string[] | undefined {
  if (!sections) {
    return undefined;
  }
  const list = sections
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return list.length > 0 ? list : undefined;
}
