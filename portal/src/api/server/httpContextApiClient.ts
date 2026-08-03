import type { ContextApiClient } from "../contextApiClient";
import { ContextApiError } from "../contextApiError";
import { createFetchContextApiClient } from "../fetchContextApiClient";
import { serverContextApiClient as inProcessContextApiClient } from "./inProcessContextApi";
import { logger, safeError } from "@atlas/logging";

export { createFetchContextApiClient } from "../fetchContextApiClient";

const log = logger("portal.context-api");

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ServerContextApiClient = ContextApiClient & {
  kind: "http" | "in-process";
};

export function createServerContextApiClient(
  input: {
    env?: Record<string, string | undefined>;
    fetch?: FetchLike;
    token?: string;
  } = {},
): ServerContextApiClient {
  const baseUrl = input.env?.CONTEXT_API_BASE_URL ?? process.env.CONTEXT_API_BASE_URL;
  if (baseUrl) {
    const client = instrumentHttpClient(
      createFetchContextApiClient({ baseUrl, fetch: input.fetch, token: input.token }),
    );
    return {
      ...client,
      kind: "http",
    };
  }

  return {
    ...inProcessContextApiClient,
    kind: "in-process",
  };
}

function instrumentHttpClient(client: ContextApiClient): ContextApiClient {
  return {
    getSource: (id, options) => loggedRequest("get_source", () => client.getSource(id, options)),
    getAvailability: (options) =>
      loggedRequest("get_availability", () => client.getAvailability(options)),
    getResourceContext: (kind, slug, options) =>
      loggedRequest("get_resource_context", () => client.getResourceContext(kind, slug, options)),
    getResourceRecord: (kind, slug, options) =>
      loggedRequest("get_resource_record", () => client.getResourceRecord(kind, slug, options)),
    searchResources: (query, options) =>
      loggedRequest("search_resources", () => client.searchResources(query, options)),
    discoverSources: (request, options) =>
      loggedRequest("discover_sources", () => client.discoverSources(request, options)),
    discoverResources: (options) =>
      loggedRequest("discover_resources", () => client.discoverResources(options)),
    submitFeedback: (request, options) =>
      loggedRequest("submit_feedback", () => client.submitFeedback(request, options)),
  };
}

async function loggedRequest<T>(operation: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    log.info(
      {
        event: "context_api.request.completed",
        operation,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      },
      "Context API request completed",
    );
    return result;
  } catch (error) {
    if (error instanceof ContextApiError) {
      log.warn(
        {
          event: "context_api.request.completed",
          operation,
          outcome: "error",
          statusCode: error.status,
          durationMs: Date.now() - startedAt,
        },
        "Context API request returned a non-success status",
      );
      throw error;
    }
    log.error(
      {
        event: "context_api.request.failed",
        operation,
        durationMs: Date.now() - startedAt,
        err: safeError(error, "Context API request failed"),
      },
      "Context API request failed",
    );
    throw error;
  }
}
