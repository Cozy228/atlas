import { describe, expect, it } from "vitest";

import { createPortalApp } from "./app";

describe("Hono portal host", () => {
  it("serves the existing health contract", async () => {
    const response = await createPortalApp().request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
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

  it("keeps dotted client routes eligible for the SPA fallback", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    const response = await app.request("/catalog.v2", {
      headers: { accept: "text/html" },
    });

    expect(response.status).toBe(200);
  });

  it("does not send reserved server namespaces to the SPA fallback", async () => {
    const app = createPortalApp({
      renderSpaDocument: () => new Response("<!doctype html>"),
    });

    for (const path of [
      "/api",
      "/mcp",
      "/mcp/session",
      "/.well-known/missing",
      "/resources/missing",
    ]) {
      const response = await app.request(path, {
        headers: { accept: "text/html" },
      });
      expect(response.status, path).toBe(404);
    }
  });

  it("serves SPA document headers for an unmatched HEAD request", async () => {
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
