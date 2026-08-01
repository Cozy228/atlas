import { describe, expect, it } from "vitest";

import {
  createAtlasLogger,
  resolveRequestId,
  runWithLogContext,
  safeError,
  withHttpRequestLogging,
} from "./index";

function captureLogs() {
  const lines: string[] = [];
  const destination = {
    write(message: string) {
      lines.push(message);
    },
  };
  return { lines, destination };
}

describe("atlas logging", () => {
  it("redacts credentials while preserving operational fields", () => {
    const { lines, destination } = captureLogs();
    const log = createAtlasLogger({ level: "info" }, destination);

    log.info(
      {
        event: "dependency.request.completed",
        statusCode: 200,
        headers: { authorization: "Bearer secret" },
        accessToken: "secret-token",
      },
      "Dependency request completed",
    );

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record.pid).toBeTypeOf("number");
    expect(record.hostname).toBeTypeOf("string");
    expect(record.event).toBe("dependency.request.completed");
    expect(record.statusCode).toBe(200);
    expect(record.accessToken).toBe("[REDACTED]");
    expect(record.headers).toEqual({ authorization: "[REDACTED]" });
  });

  it("does not allow callers to disable credential redaction", () => {
    const { lines, destination } = captureLogs();
    const log = createAtlasLogger({ level: "info", redact: [] }, destination);

    log.info({ authorization: "Bearer secret" }, "Credential test");

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record.authorization).toBe("[REDACTED]");
  });

  it("adds the active request id to records", () => {
    const { lines, destination } = captureLogs();
    const log = createAtlasLogger({ level: "info" }, destination);

    runWithLogContext({ requestId: "req-123" }, () => {
      log.info({ event: "test.completed" }, "Test completed");
    });

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record.requestId).toBe("req-123");
  });

  it("does not leak fields between records in one request context", () => {
    const { lines, destination } = captureLogs();
    const log = createAtlasLogger({ level: "info" }, destination);

    runWithLogContext({ requestId: "req-123" }, () => {
      log.info({ event: "first.completed", adapter: "memory" }, "First completed");
      log.info({ event: "second.completed", itemCount: 2 }, "Second completed");
    });

    const second = JSON.parse(lines[1] ?? "{}") as Record<string, unknown>;
    expect(second.requestId).toBe("req-123");
    expect(second.event).toBe("second.completed");
    expect(second.itemCount).toBe(2);
    expect(second).not.toHaveProperty("adapter");
  });

  it("accepts safe request ids and rejects unsafe values", () => {
    expect(resolveRequestId({ "X-Request-ID": "request_123:child" })).toBe("request_123:child");
    expect(resolveRequestId({ "x-request-id": "contains whitespace" }, "fallback-123")).toBe(
      "fallback-123",
    );
  });

  it("removes sensitive error messages while preserving type and call sites", () => {
    const original = new TypeError("request failed for https://example.com?q=secret");
    const safe = safeError(original, "Dependency request failed");

    expect(safe.name).toBe("TypeError");
    expect(safe.message).toBe("Dependency request failed");
    expect(safe.stack).not.toContain("q=secret");
    expect(safe.stack).toContain("index.test.ts");
  });

  it("owns the HTTP completion schema and request context", async () => {
    const { lines, destination } = captureLogs();
    const log = createAtlasLogger({ level: "info" }, destination);

    await withHttpRequestLogging(
      {
        log,
        requestId: "req-http-123",
        method: "GET",
        route: "/resources/:kind/:slug",
        statusCode: (response) => response.status,
      },
      async () => new Response("ok", { status: 200 }),
    );

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record).toMatchObject({
      requestId: "req-http-123",
      event: "http.request.completed",
      method: "GET",
      route: "/resources/:kind/:slug",
      statusCode: 200,
    });
    expect(record.durationMs).toBeTypeOf("number");
  });
});
