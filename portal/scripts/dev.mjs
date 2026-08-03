import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };
const defaultCliPaths = {
  vite: fileURLToPath(new URL("../../bin/vite.js", import.meta.resolve("vite"))),
  tsx: fileURLToPath(import.meta.resolve("tsx/cli")),
};

export function startDevCoordinator({
  runtime = process,
  spawnChild = spawn,
  cwd = portalRoot,
  cliPaths = defaultCliPaths,
} = {}) {
  const childCommands = [
    [cliPaths.vite, "dev"],
    [cliPaths.tsx, "watch", "server/hono/dev.ts"],
  ];
  const children = [];

  try {
    for (const args of childCommands) {
      children.push(
        spawnChild(runtime.execPath, args, {
          cwd,
          env: runtime.env,
          stdio: "inherit",
        }),
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
if (invokedPath === import.meta.url) startDevCoordinator();
