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
  handleContextRequest,
  handleFeedbackRequest,
  handleResourceContextRequest,
  handleSourceDiscoveryRequest,
  handleSourceRequest,
  handleTopicDiscoveryRequest,
  handleTopicRequest,
} from "@atlas/context-layer";
import {
  ApiErrorResponseSchema,
  AvailabilityReadResponseSchema,
  ContextBundleResponseSchema,
  FeedbackResponseSchema,
  ResourceContextResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  type AvailabilityReadResponse,
  type ContextBundleResponse,
  type ContextRequest,
  type FeedbackResponse,
  type FeedbackSubmission,
  type ResourceContextResponse,
  type SourceDiscoveryRequest,
  type SourceDiscoveryResponse,
  type SourceResponse,
  type TopicDiscoveryRequest,
  type TopicDiscoveryResponse,
  type TopicResponse,
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
  async getTopic(id: string): Promise<TopicResponse> {
    return unwrap(handleTopicRequest(id), TopicResponseSchema);
  },
  async getSource(id: string): Promise<SourceResponse> {
    return unwrap(handleSourceRequest(id), SourceResponseSchema);
  },
  async getContextBundle(request: ContextRequest): Promise<ContextBundleResponse> {
    return unwrap(await handleContextRequest(request), ContextBundleResponseSchema);
  },
  async getAvailability(): Promise<AvailabilityReadResponse> {
    return unwrap(handleAvailabilityRequest(), AvailabilityReadResponseSchema);
  },
  async getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse> {
    return unwrap(
      await handleResourceContextRequest({ kind, slug }),
      ResourceContextResponseSchema,
    );
  },
  async discoverSources(request: SourceDiscoveryRequest = {}): Promise<SourceDiscoveryResponse> {
    return unwrap(handleSourceDiscoveryRequest(request), SourceDiscoveryResponseSchema);
  },
  async discoverTopics(request: TopicDiscoveryRequest = {}): Promise<TopicDiscoveryResponse> {
    return unwrap(handleTopicDiscoveryRequest(request), TopicDiscoveryResponseSchema);
  },
  async submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse> {
    return unwrap(await handleFeedbackRequest(request), FeedbackResponseSchema);
  },
};
