/**
 * Server-only Context API client.
 *
 * This module imports the in-process Context Layer handlers and is therefore
 * never bundled into the browser. Once the Context Layer ships an HTTP
 * surface, swap the implementation here for a fetch-based client and keep
 * the same `ContextApiClient` interface so route loaders do not change.
 */
import {
  handleAvailabilityRequest,
  handleFeedbackRequest,
  handleResourceCatalogRequest,
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
  handleSourceDiscoveryRequest,
  handleSourceRequest,
} from "@atlas/context-layer";
import {
  ApiErrorResponseSchema,
  AvailabilityReadResponseSchema,
  FeedbackResponseSchema,
  ResourceCatalogResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  type AvailabilityReadResponse,
  type FeedbackResponse,
  type FeedbackSubmission,
  type ResourceCatalogResponse,
  type ResourceContextResponse,
  type ResourceRecordResponse,
  type ResourceSearchResponse,
  type SourceDiscoveryRequest,
  type SourceDiscoveryResponse,
  type SourceResponse,
} from "@atlas/schema";

import type { ContextApiClient } from "../contextApiClient";
import { ContextApiError } from "../contextApiError";

type HandlerResult = { status: number; body: unknown };

function unwrap<TBody>(result: HandlerResult, schema: { parse(input: unknown): TBody }): TBody {
  if (result.status >= 400) {
    const parsedError = ApiErrorResponseSchema.safeParse(result.body);
    if (parsedError.success) {
      throw ContextApiError.fromResponse({
        status: result.status,
        body: parsedError.data,
      });
    }
    throw new ContextApiError({
      code: "invalid_request",
      message: `Context API returned status ${result.status} with no structured error body.`,
      status: result.status,
    });
  }
  return schema.parse(result.body);
}

export const serverContextApiClient: ContextApiClient = {
  async getSource(id: string): Promise<SourceResponse> {
    return unwrap(await handleSourceRequest(id), SourceResponseSchema);
  },
  async getAvailability(): Promise<AvailabilityReadResponse> {
    return unwrap(await handleAvailabilityRequest(), AvailabilityReadResponseSchema);
  },
  async getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse> {
    return unwrap(
      await handleResourceContextRequest({ kind, slug }),
      ResourceContextResponseSchema,
    );
  },
  async getResourceRecord(kind: string, slug: string): Promise<ResourceRecordResponse> {
    return unwrap(await handleResourceRecordRequest({ kind, slug }), ResourceRecordResponseSchema);
  },
  async searchResources(query: string): Promise<ResourceSearchResponse> {
    return unwrap(await handleResourceSearchRequest(query, {}), ResourceSearchResponseSchema);
  },
  async discoverSources(request: SourceDiscoveryRequest = {}): Promise<SourceDiscoveryResponse> {
    return unwrap(await handleSourceDiscoveryRequest(request), SourceDiscoveryResponseSchema);
  },
  async discoverResources(): Promise<ResourceCatalogResponse> {
    return unwrap(await handleResourceCatalogRequest(), ResourceCatalogResponseSchema);
  },
  async submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse> {
    return unwrap(await handleFeedbackRequest(request), FeedbackResponseSchema);
  },
};
