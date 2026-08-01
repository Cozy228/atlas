import { serve } from "@hono/node-server";

import { createPortalApp, type PortalAppOptions } from "./app";

type PortalServerOptions = PortalAppOptions & {
  hostname?: string;
  port?: number;
};

export type PortalNodeServer = ReturnType<typeof serve>;

export function startPortalServer(options: PortalServerOptions = {}): PortalNodeServer {
  const app = createPortalApp({
    serveStaticAsset: options.serveStaticAsset,
    renderSpaDocument: options.renderSpaDocument,
  });

  return serve({
    fetch: app.fetch,
    hostname: options.hostname ?? "0.0.0.0",
    port: options.port ?? Number(process.env.PORT ?? 8080),
  });
}
