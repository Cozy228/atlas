import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import pino, { type DestinationStream, type Logger, type LoggerOptions } from "pino";

export type LogContext = {
  requestId?: string;
};

export type HttpRequestLogInput<T> = {
  log: Logger;
  requestId: string;
  method: string;
  route: string;
  statusCode(result: T): number;
  successLevel?: "debug" | "info";
};

const contextStorage = new AsyncLocalStorage<LogContext>();
const REDACTED = "[REDACTED]";

const redactPaths = [
  "authorization",
  "Authorization",
  "headers.authorization",
  "headers.Authorization",
  "request.headers.authorization",
  "request.headers.Authorization",
  "req.headers.authorization",
  "req.headers.Authorization",
  "cookie",
  "set-cookie",
  "headers.cookie",
  "headers.set-cookie",
  "request.headers.cookie",
  "request.headers.set-cookie",
  "req.headers.cookie",
  "req.headers.set-cookie",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "idToken",
  "id_token",
  "bearerToken",
  "sessionToken",
  "csrfToken",
  "clientSecret",
  "client_secret",
  "apiKey",
  "api_key",
  "password",
  "*.token",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
  "*.idToken",
  "*.id_token",
  "*.bearerToken",
  "*.sessionToken",
  "*.csrfToken",
  "*.clientSecret",
  "*.client_secret",
  "*.apiKey",
  "*.api_key",
  "*.password",
] as const;

export function createAtlasLogger(
  options: LoggerOptions = {},
  destination?: DestinationStream,
): Logger {
  const loggerOptions: LoggerOptions = {
    ...options,
    name: options.name ?? "atlas",
    level:
      options.level ??
      (process.env.VITEST && process.env.NODE_ENV !== "production"
        ? "silent"
        : (process.env.LOG_LEVEL ?? "info")),
    redact: {
      paths: [...redactPaths],
      censor: REDACTED,
    },
    serializers: {
      ...options.serializers,
      err: pino.stdSerializers.err,
    },
    // Pino merges log fields into the mixin object. Always return a fresh copy
    // so one record cannot mutate the AsyncLocalStorage context for later logs.
    mixin: () => ({ ...contextStorage.getStore() }),
  };

  return destination ? pino(loggerOptions, destination) : pino(loggerOptions);
}

const rootLogger = createAtlasLogger();

export function logger(component: string, bindings: Record<string, unknown> = {}): Logger {
  return rootLogger.child({ component, ...bindings });
}

export function runWithLogContext<T>(context: LogContext, run: () => T): T {
  return contextStorage.run({ ...contextStorage.getStore(), ...context }, run);
}

export function currentLogContext(): LogContext | undefined {
  return contextStorage.getStore();
}

/** Own the common HTTP completion/failure event and request correlation contract. */
export function withHttpRequestLogging<T>(
  input: HttpRequestLogInput<T>,
  run: () => Promise<T>,
): Promise<T> {
  return runWithLogContext({ requestId: input.requestId }, async () => {
    const startedAt = Date.now();
    try {
      const result = await run();
      const fields = {
        event: "http.request.completed",
        method: input.method,
        route: input.route,
        statusCode: input.statusCode(result),
        durationMs: Date.now() - startedAt,
      };
      if (input.successLevel === "debug") {
        input.log.debug(fields, "HTTP request completed");
      } else {
        input.log.info(fields, "HTTP request completed");
      }
      return result;
    } catch (err) {
      input.log.error(
        {
          event: "http.request.failed",
          method: input.method,
          route: input.route,
          durationMs: Date.now() - startedAt,
          err: safeError(err, "HTTP request failed"),
        },
        "HTTP request failed",
      );
      throw err;
    }
  });
}

/**
 * Preserve an error's type and call sites without retaining its original message.
 * Use this at boundaries where an SDK may include URLs, prompts, or payloads in errors.
 */
export function safeError(error: unknown, message: string): Error {
  const safe = new Error(message);
  safe.name = error instanceof Error ? error.name : "Error";
  if (error instanceof Error && error.stack) {
    const callSites = error.stack.split("\n").slice(1);
    safe.stack = `${safe.name}: ${message}${callSites.length ? `\n${callSites.join("\n")}` : ""}`;
  }
  return safe;
}

export function resolveRequestId(
  headers: Headers | Record<string, string | undefined> | undefined,
  fallback?: string,
): string {
  const supplied = readHeader(headers, "x-request-id");
  if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) {
    return supplied;
  }
  if (fallback && /^[A-Za-z0-9._:-]{1,128}$/.test(fallback)) {
    return fallback;
  }
  return randomUUID();
}

function readHeader(
  headers: Headers | Record<string, string | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;

  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return match?.[1];
}
