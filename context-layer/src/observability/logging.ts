/**
 * Minimal, dependency-free observability for the live path.
 *
 * Every network fetch and every resolver invocation is otherwise degraded to an
 * honest-empty result inside the layer (ADR-0006) — great for callers, blind for
 * whoever is debugging *why* something came back empty. These two decorators log
 * the request/response/duration (and the error, before it is swallowed) at the
 * two choke points that all fetchers and resolvers pass through, so the cause is
 * visible in the dev server terminal instead of vanishing behind a generic
 * warning. SSR server functions run in-process, so these lines surface wherever
 * the dev server (vite/nitro) prints — not the browser.
 *
 * Gating (three-state, mirroring `DEV_MOCKS`): `ATLAS_LOG=1` forces on, `=0`
 * forces off; otherwise on only in development (`NODE_ENV==="development"`), so
 * tests and production stay quiet. Headers are never logged and URL token-like
 * query params are redacted — no credential can leak into a log line.
 */
import type { AnchorResolver, FetchLike } from "../resolvers/resolverTypes";

function processEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

export function isLoggingEnabled(env: Record<string, string | undefined> = processEnv()): boolean {
  const flag = env.ATLAS_LOG;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return env.NODE_ENV === "development";
}

/** Strip token-like query params so a logged URL can never carry a credential. */
function redactUrl(input: string): string {
  return input.replace(/([?&](?:token|access_token|api_key|apikey|key|password)=)[^&]*/gi, "$1***");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emit(channel: string, message: string, isError = false): void {
  const line = `[atlas:${channel}] ${message}`;
  if (isError) {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * Wrap an injected `FetchLike` so every request logs `method url → status (ms)`,
 * and a transport failure logs `→ ERR (ms) <message>` before it propagates (and
 * is typically caught + degraded by the fetcher). Zero overhead when disabled.
 */
export function withFetchLogging(fetch: FetchLike): FetchLike {
  return async (input, init) => {
    if (!isLoggingEnabled()) {
      return fetch(input, init);
    }
    const method = init?.method ?? "GET";
    const url = redactUrl(input);
    const started = Date.now();
    try {
      const response = await fetch(input, init);
      emit(
        "fetch",
        `${method} ${url} → ${response.status} (${Date.now() - started}ms)`,
        !response.ok,
      );
      return response;
    } catch (error) {
      emit(
        "fetch",
        `${method} ${url} → ERR (${Date.now() - started}ms) ${errorMessage(error)}`,
        true,
      );
      throw error;
    }
  };
}

/** A short, credential-free description of what a resolve request pins. */
function describeRequest(request: Parameters<AnchorResolver["resolve"]>[0]): string {
  if (request.heading) {
    return `heading="${request.heading}"`;
  }
  const selector = request.selector;
  if (selector && Object.keys(selector).length > 0) {
    const pairs = Object.entries(selector).map(([k, v]) => `${k}=${v}`);
    return `selector={${pairs.join(", ")}}`;
  }
  return "selector={}";
}

/**
 * Wrap an `AnchorResolver` so every resolve logs its source, what it pinned, and
 * the outcome — `N excerpt(s), M warning(s) [codes]` — plus duration, and a throw
 * as `→ THREW <message>`. This makes "why is this excerpt missing" answerable: a
 * `broken_anchor` / `source_unavailable` warning shows here, its HTTP cause shows
 * in the paired `[atlas:fetch]` line.
 */
export function withResolverLogging(resolver: AnchorResolver): AnchorResolver {
  return {
    sourceClass: resolver.sourceClass,
    async resolve(request) {
      if (!isLoggingEnabled()) {
        return resolver.resolve(request);
      }
      const label = `${resolver.sourceClass} source=${request.source.id} ${describeRequest(request)}`;
      const started = Date.now();
      try {
        const result = await resolver.resolve(request);
        const codes = result.warnings.map((w) => w.code);
        const codesText = codes.length > 0 ? ` [${codes.join(", ")}]` : "";
        emit(
          "resolve",
          `${label} → ${result.excerpts.length} excerpt(s), ${result.warnings.length} warning(s)${codesText} (${Date.now() - started}ms)`,
          result.excerpts.length === 0,
        );
        return result;
      } catch (error) {
        emit(
          "resolve",
          `${label} → THREW ${errorMessage(error)} (${Date.now() - started}ms)`,
          true,
        );
        throw error;
      }
    },
  };
}
