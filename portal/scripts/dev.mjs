import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

export function isSameModuleUrl(moduleUrl, invokedUrl, platform = process.platform) {
  if (platform !== "win32") return moduleUrl === invokedUrl;

  const normalizeDriveLetter = (url) =>
    url.replace(/^file:\/\/\/([A-Z]):/, (_, driveLetter) =>
      `file:///${driveLetter.toLowerCase()}:`,
    );
  return normalizeDriveLetter(moduleUrl) === normalizeDriveLetter(invokedUrl);
}

export function startDevCoordinator({
  runtime = process,
  spawnChild = spawn,
  cwd = portalRoot,
} = {}) {
  const npmExecPath = runtime.env.npm_execpath;
  console.error(
    "[DEBUG-windows-dev] coordinator",
    JSON.stringify({ execPath: runtime.execPath, npmExecPath }),
  );
  if (!npmExecPath) {
    throw new Error("npm_execpath is required; start the portal with its pnpm dev script.");
  }

  const childCommands = [
    [npmExecPath, "exec", "vite", "dev"],
    [npmExecPath, "exec", "tsx", "watch", "server/hono/dev.ts"],
  ];
  const children = [];

  try {
    for (const args of childCommands) {
      const child = spawnChild(runtime.execPath, args, {
          cwd,
          env: runtime.env,
          stdio: "inherit",
        });
      child.once("spawn", () => {
        console.error("[DEBUG-windows-dev] child spawned", JSON.stringify({ args }));
      });
      child.once("error", (error) => {
        console.error(
          "[DEBUG-windows-dev] child error",
          JSON.stringify({ args, error: String(error) }),
        );
      });
      children.push(
        child,
      );
    }
  } catch (error) {
    for (const child of children) child.kill("SIGTERM");
    throw error;
  }

  let requestedExitCode;
  let stopping = false;
  const settledChildren = new Set();

  const stopChildren = (signal) => {
    stopping = true;
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    }
  };

  const signalHandlers = Object.fromEntries(
    Object.entries(signalExitCodes).map(([signal, exitCode]) => [
      signal,
      () => {
        if (stopping) return;
        requestedExitCode = exitCode;
        stopChildren(signal);
      },
    ]),
  );

  for (const [signal, handler] of Object.entries(signalHandlers)) runtime.on(signal, handler);

  const settleChild = (child, code, signal) => {
    if (settledChildren.has(child)) return;
    settledChildren.add(child);

    if (!stopping) {
      requestedExitCode = code ?? signalExitCodes[signal] ?? 1;
      stopChildren("SIGTERM");
    }

    if (settledChildren.size !== children.length) return;
    for (const [registeredSignal, handler] of Object.entries(signalHandlers)) {
      runtime.off(registeredSignal, handler);
    }
    runtime.exitCode = requestedExitCode ?? 0;
  };

  for (const child of children) {
    child.once("exit", (code, signal) => settleChild(child, code, signal));
    child.once("error", () => settleChild(child, 1, null));
  }

  return { children, stop: stopChildren };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
console.error(
  "[DEBUG-windows-dev] entry",
  JSON.stringify({
    platform: process.platform,
    moduleUrl: import.meta.url,
    invokedPath,
    isSame: invokedPath ? isSameModuleUrl(import.meta.url, invokedPath) : false,
  }),
);
if (invokedPath && isSameModuleUrl(import.meta.url, invokedPath)) startDevCoordinator();
