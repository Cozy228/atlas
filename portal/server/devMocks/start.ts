/** Dev-only MSW lifecycle. Imported only by the standalone Hono dev entry. */
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";
import { logger } from "@atlas/logging";

import { shouldMockData } from "./shouldMock";

const log = logger("portal.runtime");

const modifiedEnvKeys = [
  "DEV_DATA_MODE",
  "DEV_MOCK_LATENCY_MS",
  "TERRAFORM_BASE_URL",
  "TERRAFORM_TOKEN",
  "CONFLUENCE_BASE_URL",
  "CONFLUENCE_TOKEN",
  "CONFLUENCE_SECURITY_SPACE_KEY",
  "CONFLUENCE_AVAILABILITY_PAGE_AWSF",
  "CONFLUENCE_RELEASE_NOTES_PAGE_ID",
  "GUIDANCE_URL",
  "CONFLUENCE_GUIDANCE_ONBOARDING_PAGE_ID",
  "CONFLUENCE_SPACE_KEYS",
] as const;

let activeCleanup: (() => void) | undefined;

export function initializeDevMocks(): () => void {
  if (activeCleanup) return activeCleanup;

  const previousEnv = new Map(modifiedEnvKeys.map((key) => [key, process.env[key]]));
  const mock = shouldMockData();
  process.env.DEV_DATA_MODE = mock ? "mock" : "live";
  log.info(
    { event: "runtime.data_mode.configured", dataMode: mock ? "mock" : "live" },
    "Runtime data mode configured",
  );

  try {
    if (mock) {
      if (!process.env.DEV_MOCK_LATENCY_MS) process.env.DEV_MOCK_LATENCY_MS = "800";
      setDevDiscoveryEnv();
      server.listen({ onUnhandledRequest: "bypass" });
      log.info(
        { event: "runtime.dev_mocks.started", latencyMs: Number(process.env.DEV_MOCK_LATENCY_MS) },
        "Development source mocks started",
      );
    }
  } catch (error) {
    restoreEnvironment(previousEnv);
    throw error;
  }

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (mock) server.close();
    if (mock) log.info({ event: "runtime.dev_mocks.stopped" }, "Development source mocks stopped");
    restoreEnvironment(previousEnv);
    if (activeCleanup === cleanup) activeCleanup = undefined;
  };
  activeCleanup = cleanup;
  return cleanup;
}

function restoreEnvironment(previousEnv: ReadonlyMap<string, string | undefined>): void {
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
