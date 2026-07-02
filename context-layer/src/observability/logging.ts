/**
 * Structured, always-on observability for the live path (pino-backed).
 *
 * Every network fetch and every resolver invocation is otherwise degraded to an
 * honest-empty result inside the layer (ADR-0006) — great for callers, blind for
 * whoever is debugging *why* something came back empty. This module gives the
 * layer ONE structured logger so the cause is visible wherever the process
 * writes (the dev terminal AND the prod ECS/CloudWatch task log), not just in a
 * developer's terminal.
 *
 * Design (the previous `ATLAS_LOG` on/off gate was a design error — it left prod
 * silent by default, exactly where the cause is needed most):
 *   - ALWAYS on. Verbosity is a LEVEL, not a switch. `LOG_LEVEL` overrides;
 *     otherwise the default is `info` in production, `silent` under test (keep
 *     the test output clean), and `debug` in development. So prod keeps
 *     warnings/errors, dev sees the full request trace, tests stay quiet.
 *   - STRUCTURED. Every line is NDJSON with a `channel` field and a readable
 *     `msg` — queryable in CloudWatch Logs Insights, still legible raw.
 *   - CAUSE-PRESERVING. A Node `TypeError: fetch failed` carries its real reason
 *     (`ECONNREFUSED` / `ENOTFOUND` / `UND_ERR_CONNECT_TIMEOUT`) in `error.cause`;
 *     `serializeError` unwinds it so the log answers *why* the fetch failed.
 *   - SAFE. Headers/tokens are never logged and token-like URL query params are
 *     redacted — no credential can leak into a log line.
 *
 * No worker-thread transport is configured, so the logger bundles cleanly into
 * the Nitro/rolldown prod output and needs no special externalization.
 */
import pino from "pino";
import type { AnchorResolver, FetchLike } from "../resolvers/resolverTypes";

function processEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/** Log level: explicit `LOG_LEVEL` wins; else prod=info, test=silent, dev=debug. */
function resolveLevel(env: Record<string, string | undefined> = processEnv()): string {
  const explicit = env.LOG_LEVEL?.trim().toLowerCase();
  if (explicit) return explicit;
  if (env.NODE_ENV === "production") return "info";
  if (env.NODE_ENV === "test") return "silent";
  return "debug";
}

// One process-wide root logger, created lazily on first use so the level is read
// after the runtime has populated env. `base: undefined` drops pino's pid/hostname
// (ECS already tags the stream); the level is emitted as its label ("warn") rather
// than a number so CloudWatch reads cleanly.
let rootLogger: pino.Logger | undefined;
function root(): pino.Logger {
  if (!rootLogger) {
    rootLogger = pino({
      level: resolveLevel(),
      base: undefined,
      messageKey: "msg",
      formatters: { level: (label) => ({ level: label }) },
    });
  }
  return rootLogger;
}

// Memoize one child per channel: callers on the hot path (a child per fetch /
// per request) reuse the same instance, and a test can spy on the exact child.
const channelLoggers = new Map<string, pino.Logger>();

/** A child logger bound to a `channel` (fetch / resolve / discovery / cache / ask). */
export function logger(channel: string): pino.Logger {
  let child = channelLoggers.get(channel);
  if (!child) {
    child = root().child({ channel });
    channelLoggers.set(channel, child);
  }
  return child;
}

/** Strip token-like query params so a logged URL can never carry a credential. */
function redactUrl(input: string): string {
  return input.replace(/([?&](?:token|access_token|api_key|apikey|key|password)=)[^&]*/gi, "$1***");
}

type SerializedError = {
  name?: string;
  message: string;
  code?: string;
  cause?: SerializedError | string;
};

/** Unwind an error (and its `cause` chain) into a structured, credential-free shape. */
export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const cause = (error as { cause?: unknown }).cause;
  return {
    name: error.name,
    message: error.message,
    code: (error as { code?: string }).code,
    cause:
      cause instanceof Error
        ? serializeError(cause)
        : cause !== undefined
          ? String(cause)
          : undefined,
  };
}

/**
 * A one-line, credential-free summary of an error INCLUDING its cause — this is
 * what turns a bare `fetch failed` into `fetch failed (ECONNREFUSED: connect
 * ECONNREFUSED 10.0.0.1:443)` in the human `msg`.
 */
export function errorSummary(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    const causeText = code ? `${code}: ${cause.message}` : `${cause.name}: ${cause.message}`;
    return `${error.message} (${causeText})`;
  }
  if (cause !== undefined) {
    return `${error.message} (${String(cause)})`;
  }
  return error.message;
}

/**
 * Wrap an injected `FetchLike` so every request logs `method url → status (ms)`
 * (at `debug` on success, `warn` on a non-ok status) and a transport failure
 * logs `→ ERR (ms) <message + cause>` at `error` before it propagates (and is
 * typically caught + degraded by the fetcher). Below-level calls are cheap
 * no-ops in pino, so prod (default `info`) stays quiet on healthy traffic.
 */
export function withFetchLogging(fetch: FetchLike): FetchLike {
  const log = logger("fetch");
  return async (input, init) => {
    const method = init?.method ?? "GET";
    const url = redactUrl(input);
    const started = Date.now();
    try {
      const response = await fetch(input, init);
      const durationMs = Date.now() - started;
      const fields = { method, url, status: response.status, durationMs };
      const line = `${method} ${url} → ${response.status} (${durationMs}ms)`;
      if (response.ok) {
        log.debug(fields, line);
      } else {
        log.warn(fields, line);
      }
      return response;
    } catch (error) {
      const durationMs = Date.now() - started;
      log.error(
        { method, url, durationMs, err: serializeError(error) },
        `${method} ${url} → ERR (${durationMs}ms) ${errorSummary(error)}`,
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
 * the outcome — `N excerpt(s), M warning(s) [codes]` — plus duration (at `debug`
 * when it returned evidence, `warn` when it came back empty), and a throw as
 * `→ THREW <message>` at `error`. This makes "why is this excerpt missing"
 * answerable: a `broken_anchor` / `source_unavailable` warning shows here, its
 * HTTP cause shows in the paired `fetch` line.
 */
export function withResolverLogging(resolver: AnchorResolver): AnchorResolver {
  const log = logger("resolve");
  return {
    sourceClass: resolver.sourceClass,
    async resolve(request) {
      const label = `${resolver.sourceClass} source=${request.source.id} ${describeRequest(request)}`;
      const started = Date.now();
      try {
        const result = await resolver.resolve(request);
        const codes = result.warnings.map((w) => w.code);
        const durationMs = Date.now() - started;
        const fields = {
          sourceClass: resolver.sourceClass,
          sourceId: request.source.id,
          excerpts: result.excerpts.length,
          warnings: codes,
          durationMs,
        };
        const codesText = codes.length > 0 ? ` [${codes.join(", ")}]` : "";
        const line = `${label} → ${result.excerpts.length} excerpt(s), ${result.warnings.length} warning(s)${codesText} (${durationMs}ms)`;
        if (result.excerpts.length === 0) {
          log.warn(fields, line);
        } else {
          log.debug(fields, line);
        }
        return result;
      } catch (error) {
        log.error(
          {
            sourceClass: resolver.sourceClass,
            sourceId: request.source.id,
            err: serializeError(error),
          },
          `${label} → THREW ${errorSummary(error)} (${Date.now() - started}ms)`,
        );
        throw error;
      }
    },
  };
}
