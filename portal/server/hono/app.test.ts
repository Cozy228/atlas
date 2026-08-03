import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { createPortalApp } from "./app";

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv();
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

describe("Hono portal host", () => {
  it("serves the existing health contract", async () => {
    const response = await createPortalApp().request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("reports unavailable readiness while the host drains", async () => {
    const response = await createPortalApp({ isReady: () => false }).request("/health");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "draining" });
  });

  it("tracks each request through response completion", async () => {
    const events: string[] = [];
    const response = await createPortalApp({
      onRequestStart: () => {
        events.push("start");
        return () => events.push("finish");
      },
    }).request("/health");

    expect(response.status).toBe(200);
    await response.text();
    expect(events).toEqual(["start", "finish"]);
  });

  it("keeps a streamed document active until its body closes", async () => {
    const events: string[] = [];
    let closeStream: (() => void) | undefined;
    const app = createPortalApp({
      onRequestStart: () => {
        events.push("start");
        return () => events.push("finish");
      },
      renderSpaDocument: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("<!doctype html>"));
              closeStream = () => controller.close();
            },
          }),
          { headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    });

    const response = await app.request("/", { headers: { accept: "text/html" } });
    const reader = response.body!.getReader();
    await reader.read();
    expect(events).toEqual(["start"]);

    closeStream?.();
    await reader.read();
    expect(events).toEqual(["start", "finish"]);
  });

  it("keeps unmatched Context API requests inside the JSON API contract", async () => {
    const response = await createPortalApp().request("/api/not-registered");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Route was not found.",
      },
    });
  });

  it("routes the internal OpenAPI document before the Context API catch-all", async () => {
    const response = await createPortalApp().request(
      "https://portal.example.com/api/internal/openapi.json",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/openapi+json");
    const document = (await response.json()) as {
      openapi: string;
      servers: Array<{ url: string }>;
    };
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers[0]?.url).toBe("https://portal.example.com/api");
  });

  it.each([
    ["/.well-known/ai-catalog.json", "application/json"],
    ["/.well-known/api-catalog", "application/linkset+json"],
    ["/.well-known/mcp/server-card.json", "application/json"],
    ["/.well-known/oauth-protected-resource", "application/json"],
    ["/llms.txt", "text/plain"],
    ["/openapi.json", "application/openapi+json"],
    ["/robots.txt", "text/plain"],
  ])("registers the discovery route %s", async (path, contentType) => {
    const response = await createPortalApp().request(`https://portal.example.com${path}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(contentType);
    expect((await response.text()).length).toBeGreaterThan(20);
  });

  it("preserves the MCP HTTP method and initialize contracts", async () => {
    const app = createPortalApp();

    const getResponse = await app.request("/mcp");
    const initializeResponse = await app.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "atlas-hono-test", version: "1.0.0" },
        },
      }),
    });

    expect(getResponse.status).toBe(405);
    expect(initializeResponse.status).toBe(200);
    const event = (await initializeResponse.text())
      .split("\n")
      .find((line) => line.startsWith("data: "));
    const message = JSON.parse(event?.slice("data: ".length) ?? "{}") as {
      result: { serverInfo: { name: string } };
    };
    expect(message.result.serverInfo.name).toBe("atlas");
  });

  it("serves the live resource Markdown projection outside the document fallback", async () => {
    const app = createPortalApp();
    const apiResponse = await app.request(
      "https://portal.example.com/api/resources/service/aws/textract",
    );
    const response = await app.request(
      "https://portal.example.com/resources/service/aws/textract.md",
    );

    expect(apiResponse.status).toBe(200);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    await expect(response.text()).resolves.toContain("# Amazon Textract");
  });

  it("serves the live sitemap from the explicit server route registry", async () => {
    const response = await createPortalApp().request("https://portal.example.com/sitemap.xml");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("https://portal.example.com/service/aws/textract");
  });

  it("adds request-derived discovery links only to the homepage", async () => {
    const app = createPortalApp({ renderSpaDocument: () => new Response("<!doctype html>") });

    const homeResponse = await app.request("https://portal.acme.example/", {
      headers: { accept: "text/html" },
    });
    const catalogResponse = await app.request("https://portal.acme.example/catalog", {
      headers: { accept: "text/html" },
    });

    expect(homeResponse.headers.get("link")).toContain(
      '<https://portal.acme.example/llms.txt>; rel="llms-txt"',
    );
    expect(homeResponse.headers.get("link")).toContain('rel="mcp-server"');
    expect(homeResponse.headers.get("link")).toContain('rel="sitemap"');
    expect(catalogResponse.headers.has("link")).toBe(false);
  });

  it("preserves the established method-wildcard route behavior", async () => {
    const app = createPortalApp();

    for (const path of [
      "/health",
      "/llms.txt",
      "/openapi.json",
      "/.well-known/api-catalog",
      "/api/internal/openapi.json",
    ]) {
      const response = await app.request(path, { method: "POST" });
      expect(response.status, path).toBe(200);
    }
  });

  it("keeps exact API and resource roots inside their server contracts", async () => {
    const app = createPortalApp({ renderSpaDocument: () => new Response("<!doctype html>") });

    for (const path of ["/api", "/api/"]) {
      const response = await app.request(path, { headers: { accept: "text/html" } });
      expect(response.status, path).toBe(404);
      expect(response.headers.get("content-type"), path).toContain("application/json");
    }

    const resourceResponse = await app.request("/resources", {
      headers: { accept: "text/html" },
    });
    expect(resourceResponse.status).toBe(404);
    await expect(resourceResponse.text()).resolves.toBe("Not found");
  });

  it("serves the migrated browser query and mutation contracts", async () => {
    const app = createPortalApp();
    const catalogResponse = await app.request("/api/resources/catalog");
    const sourcesResponse = await app.request("/api/sources?query=module");
    const resourceRecordResponse = await app.request("/api/resources/service/aws/textract/record");
    const invalidFeedbackResponse = await app.request("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const feedbackResponse = await app.request("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_type: "resource",
        target_id: "service/aws/textract",
        feedback_type: "missing",
        message: "Add region guidance.",
      }),
    });

    expect(catalogResponse.status).toBe(200);
    const catalog = (await catalogResponse.json()) as { resources: Array<{ id: string }> };
    expect(catalog.resources.some((resource) => resource.id === "service/aws/textract")).toBe(true);
    expect(sourcesResponse.status).toBe(200);
    expect(resourceRecordResponse.status).toBe(200);
    expect(invalidFeedbackResponse.status).toBe(400);
    expect(feedbackResponse.status).toBe(201);
    const feedback = (await feedbackResponse.json()) as { feedback: { target_id: string } };
    expect(feedback.feedback.target_id).toBe("service/aws/textract");
  });

  it.each([
    ["/api/portal/landing-zones", "landingZones"],
    ["/api/portal/availability", "zones"],
    ["/api/portal/guidance", "guidance"],
    ["/api/portal/announcements", "announcements"],
    ["/api/portal/releases", "releases"],
  ])("serves the Portal-only query contract %s", async (path, key) => {
    const response = await createPortalApp().request(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as Record<string, unknown>;
    expect(Array.isArray(body[key])).toBe(true);
  });

  it("serves data mode without accepting mutation methods", async () => {
    const app = createPortalApp();
    const response = await app.request("/api/portal/data-mode");
    const postResponse = await app.request("/api/portal/data-mode", { method: "POST" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ dataMode: "live" });
    expect(postResponse.status).toBe(404);
    expect(postResponse.headers.get("content-type")).toContain("application/json");
  });

  it("serves Ask Atlas through an explicit validated HTTP contract", async () => {
    const app = createPortalApp();
    const invalidResponse = await app.request("/api/portal/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const response = await app.request("/api/portal/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceSlug: "aws/textract",
        question: "What governed evidence is available?",
      }),
    });

    expect(invalidResponse.status).toBe(400);
    await expect(invalidResponse.json()).resolves.toMatchObject({
      error: { code: "invalid_request" },
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      answer: expect.any(String),
      sources: expect.any(Array),
      warnings: expect.any(Array),
    });
  });

  it("serves an unmatched browser document from the SPA fallback", async () => {
    const app = createPortalApp({
      renderSpaDocument: () =>
        new Response('<!doctype html><div id="app"></div>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });

    const response = await app.request("/catalog", {
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain('<div id="app"></div>');
  });

  it("does not turn a missing asset into SPA HTML", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    const response = await app.request("/assets/missing.js", {
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("<!doctype html>");
  });

  it("does not turn a missing root-level file into SPA HTML", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    for (const path of ["/missing-asset.js", "/missing.html"]) {
      const response = await app.request(path, {
        headers: { accept: "text/html" },
      });
      expect(response.status, path).toBe(404);
    }
  });

  it("does not serve SPA HTML when the request rejects HTML", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    const response = await app.request("/catalog", {
      headers: { accept: "text/html;q=0, */*;q=1" },
    });

    expect(response.status).toBe(404);
  });

  it("keeps dotted client routes eligible for the Start fallback", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    const response = await app.request("/catalog.v2", {
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(200);
  });

  it("does not send reserved server namespaces to the Start fallback", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    for (const [path, expectedStatus] of [
      ["/api", 404],
      ["/mcp", 405],
      ["/mcp/session", 404],
      ["/.well-known/missing", 404],
      ["/resources/missing", 404],
    ] as const) {
      const response = await app.request(path, {
        headers: { accept: "text/html" },
      });
      expect(response.status, path).toBe(expectedStatus);
      expect(response.headers.get("content-type"), path).not.toContain("text/html");
    }
  });

  it("serves Start document headers for an unmatched HEAD request", async () => {
    const app = createPortalApp({
      renderSpaDocument: () =>
        new Response("<!doctype html>", {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-atlas-spa": "1",
          },
        }),
    });

    const response = await app.request("/catalog", {
      method: "HEAD",
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-atlas-spa")).toBe("1");
    await expect(response.text()).resolves.toBe("");
  });
});
