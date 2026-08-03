import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { closeSourceContentCache, configureOutboundProxy } from "@atlas/context-layer";
import { logger, safeError } from "@atlas/logging";

import { createGracefulShutdown, type GracefulShutdown } from "./gracefulShutdown";
import { startPortalServer, type PortalNodeServer } from "./server";
import { loadStaticAssetService, type StaticAssetManifest } from "./staticAssets";

export type ProductionPortalRuntime = {
  server: PortalNodeServer;
  shutdown: GracefulShutdown;
};

const runtimeLog = logger("portal.runtime");
const requestLog = logger("portal.http");

export async function startProductionPortal(options: {
  serverRoot: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ProductionPortalRuntime> {
  const env = options.env ?? process.env;
  const config = productionConfig(env);
  const outboundProxy = configureOutboundProxy(env);
  const outputRoot = resolve(options.serverRoot, "..");
  const publicRoot = resolve(outputRoot, "public");
  const manifest = JSON.parse(
    await readFile(resolve(options.serverRoot, "assets-manifest.json"), "utf8"),
  ) as StaticAssetManifest;
  const staticAssets = await loadStaticAssetService({ publicRoot, manifest });
  let ready = false;
  let activeRequests = 0;
  const logLifecycleEvent = (event: Record<string, unknown>) => {
    runtimeLog.info(event, "Portal lifecycle event");
  };

  const server = startPortalServer({
    port: config.port,
    isReady: () => ready,
    onRequestStart: () => {
      activeRequests += 1;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        activeRequests -= 1;
      };
    },
    onRequestComplete: (event) => {
      if (event.status >= 500) {
        requestLog.error(event, "HTTP request completed with server error");
      } else if (event.status >= 400 || event.aborted) {
        requestLog.warn(event, "HTTP request completed with degraded outcome");
      } else {
        requestLog.info(event, "HTTP request completed");
      }
    },
    serveStaticAsset: (request) => staticAssets.serve(request),
    renderSpaDocument: async (request) => {
      const response = await staticAssets.serve(request, "/index.html");
      if (!response) throw new Error("The SPA document is missing from the asset manifest.");
      return response;
    },
  });

  server.once("listening", () => {
    ready = true;
    runtimeLog.info(
      { event: "ready", port: config.port, artifact: "atlas-hono-router-spa" },
      "Portal runtime ready",
    );
  });

  const shutdown = createGracefulShutdown({
    server,
    deadlineMs: config.shutdownDeadlineMs,
    closeHooks: [closeSourceContentCache, ...(outboundProxy ? [outboundProxy.close] : [])],
    markDraining: () => {
      ready = false;
    },
    activeRequests: () => activeRequests,
    onEvent: logLifecycleEvent,
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdown
        .shutdown(signal)
        .then(({ forced }) => {
          if (forced) process.exit(1);
          process.exitCode = 0;
        })
        .catch((error: unknown) => {
          runtimeLog.error(
            { event: "drain-failed", err: safeError(error, "Portal drain failed") },
            "Portal drain failed",
          );
          process.exit(1);
        });
    });
  }

  return { server, shutdown };
}

export function productionConfig(env: NodeJS.ProcessEnv): {
  port: number;
  shutdownDeadlineMs: number;
} {
  return {
    port: positiveInteger("PORT", env.PORT ?? "8080", 65_535),
    shutdownDeadlineMs: positiveInteger(
      "SHUTDOWN_TIMEOUT_MS",
      env.SHUTDOWN_TIMEOUT_MS ?? "25000",
      2_147_483_647,
    ),
  };
}

function positiveInteger(name: string, rawValue: string, maximum: number): number {
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return value;
}
