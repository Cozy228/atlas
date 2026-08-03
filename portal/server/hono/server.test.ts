import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { startPortalServer, type PortalNodeServer } from "./server";

describe("Hono Node host", () => {
  let server: PortalNodeServer | undefined;

  afterEach(async () => {
    if (!server) return;
    const runningServer = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => {
      runningServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("serves the portal app through a real Node listener", async () => {
    server = startPortalServer({ hostname: "127.0.0.1", port: 0 });
    await once(server, "listening");

    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("preserves the SPA fallback boundary through the Node adapter", async () => {
    server = startPortalServer({
      hostname: "127.0.0.1",
      port: 0,
      serveStaticAsset: (request) =>
        new URL(request.url).pathname === "/app.js"
          ? new Response("export {};", {
              headers: { "content-type": "text/javascript; charset=utf-8" },
            })
          : undefined,
      renderSpaDocument: () =>
        new Response('<!doctype html><div id="app"></div>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;

    const documentResponse = await fetch(`${origin}/catalog`, {
      headers: { accept: "text/html" },
    });
    const assetResponse = await fetch(`${origin}/missing.js`, {
      headers: { accept: "text/html" },
    });
    const existingAssetResponse = await fetch(`${origin}/app.js`);

    expect(documentResponse.status).toBe(200);
    await expect(documentResponse.text()).resolves.toContain('<div id="app"></div>');
    expect(assetResponse.status).toBe(404);
    expect(existingAssetResponse.status).toBe(200);
    await expect(existingAssetResponse.text()).resolves.toBe("export {};");
  });
});
