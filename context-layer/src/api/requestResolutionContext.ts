import type { ResolutionContext } from "../resolvers/resolverTypes";
import { cachedResolutionContext } from "../sourceContent/sourceContentCache";

type HeaderSource = Headers | Record<string, string | undefined>;

/** Build request-scoped source access without parsing or persisting the caller's token. */
export async function resolutionContextFromHeaders(
  headers?: HeaderSource,
  signal?: AbortSignal,
): Promise<ResolutionContext> {
  const base = await cachedResolutionContext();
  const token = bearerToken(headers);
  const fetch = signal
    ? (input: string, init?: Parameters<typeof base.fetch>[1]) =>
        base.fetch(input, { ...init, signal: init?.signal ?? signal })
    : base.fetch;
  return { ...base, fetch, ...(token ? { token } : {}) };
}

function bearerToken(headers?: HeaderSource): string | undefined {
  const value =
    headers instanceof Headers
      ? headers.get("authorization")
      : Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === "authorization")?.[1];
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
