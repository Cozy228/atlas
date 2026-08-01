import { logger } from "@atlas/logging";
import type { NitroAppPlugin } from "nitro/types";

const log = logger("portal.runtime");

const runtimeLogging: NitroAppPlugin = (nitro) => {
  const startedAt = Date.now();
  let stopping = false;
  log.info(
    {
      event: "runtime.started",
      runtime: "nitro",
      environment: process.env.NODE_ENV ?? "production",
    },
    "Portal runtime started",
  );

  const logStop = (reason: "nitro_close" | "sigint" | "sigterm") => {
    if (stopping) return;
    stopping = true;
    log.info(
      { event: "runtime.stopping", reason, uptimeMs: Date.now() - startedAt },
      "Portal runtime stopping",
    );
  };

  nitro.hooks.hook("close", () => logStop("nitro_close"));
  process.once("SIGINT", () => logStop("sigint"));
  process.once("SIGTERM", () => logStop("sigterm"));
};

export default runtimeLogging;
