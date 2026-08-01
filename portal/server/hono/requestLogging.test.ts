import { describe, expect, it } from "vitest";

import { createPortalApp } from "./app";

describe("Hono request logging", () => {
  it("reports fixed request metadata without headers or query payloads", async () => {
    const events: unknown[] = [];
    const times = [2_000, 2_017];
    const app = createPortalApp({
      now: () => times.shift() ?? 2_017,
      onRequestComplete: (event) => events.push(event),
    });

    const response = await app.request("https://portal.example.com/health?token=query-secret", {
      method: "POST",
      headers: {
        authorization: "Bearer authorization-secret",
        cookie: "session=cookie-secret",
        "x-request-id": "request-log-123",
      },
    });

    expect(response.status).toBe(200);
    expect(events).toEqual([
      {
        event: "request",
        requestId: "request-log-123",
        method: "POST",
        path: "/health",
        status: 200,
        latencyMs: 17,
        aborted: false,
      },
    ]);
    expect(JSON.stringify(events)).not.toMatch(
      /query-secret|authorization-secret|cookie-secret|token|authorization|cookie/i,
    );
  });

  it("marks an aborted request without logging its abort reason", async () => {
    const events: unknown[] = [];
    const controller = new AbortController();
    controller.abort("private abort reason");
    const request = new Request("https://portal.example.com/health", {
      signal: controller.signal,
    });

    const response = await createPortalApp({
      onRequestComplete: (event) => events.push(event),
    }).fetch(request);

    expect(response.status).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: "request", path: "/health", aborted: true });
    expect(JSON.stringify(events)).not.toContain("private abort reason");
  });
});
