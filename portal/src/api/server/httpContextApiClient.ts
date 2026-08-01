import type { ContextApiClient } from "../contextApiClient";
import { createFetchContextApiClient } from "../fetchContextApiClient";
import { serverContextApiClient as inProcessContextApiClient } from "./inProcessContextApi";

export { createFetchContextApiClient } from "../fetchContextApiClient";

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
    return {
      ...createFetchContextApiClient({ baseUrl, fetch: input.fetch, token: input.token }),
      kind: "http",
    };
  }

  return {
    ...inProcessContextApiClient,
    kind: "in-process",
  };
}
