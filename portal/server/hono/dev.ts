import { loadEnv } from "vite";
import { closeSourceContentCache, configureOutboundProxy } from "@atlas/context-layer";

for (const [key, value] of Object.entries(loadEnv("development", process.cwd(), ""))) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const outboundProxy = configureOutboundProxy(process.env);

const { initializeDevMocks } = await import("../devMocks/start");
const cleanupDevMocks = initializeDevMocks();
process.once("exit", cleanupDevMocks);

const { startPortalServer } = await import("./server");
const server = startPortalServer({ hostname: "127.0.0.1", port: 3001 });

server.once("listening", () => {
  console.log("Hono dev server listening on http://127.0.0.1:3001");
});
server.once("error", (error) => {
  cleanupDevMocks();
  console.error(error);
  process.exitCode = 1;
});

let stopping = false;
function stop(signal: NodeJS.Signals): void {
  if (stopping) return;
  stopping = true;
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  server.close((error) => {
    void closeDevResources().then(
      () => {
        if (!error) return;
        console.error(error);
        process.exitCode = 1;
      },
      (closeError: unknown) => {
        console.error(closeError);
        process.exitCode = 1;
      },
    );
  });
}

async function closeDevResources(): Promise<void> {
  cleanupDevMocks();
  await closeSourceContentCache();
  await outboundProxy?.close();
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
