import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const portalRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const signalExitCodes = { SIGINT: 130, SIGTERM: 143 };

export function startDevCoordinator({
  runtime = process,
  spawnChild = spawn,
  cwd = portalRoot,
} = {}) {
  const npmExecPath = runtime.env.npm_execpath;
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
      child.once("exit", (code, signal) => {
        console.error(
          "[DEBUG-windows-dev] early child exit",
          JSON.stringify({ command: args.slice(1, 3), code, signal }),
        );
      });
      child.once("error", (error) => {
        console.error(
          "[DEBUG-windows-dev] child error",
          JSON.stringify({ command: args.slice(1, 3), error: String(error) }),
        );
      });
      children.push(child);
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

  setTimeout(() => {
    console.error(
      "[DEBUG-windows-dev] child states after 5s",
      JSON.stringify(
        children.map((child, index) => ({
          command: childCommands[index].slice(1, 3),
          pid: child.pid,
          exitCode: child.exitCode,
          signalCode: child.signalCode,
        })),
      ),
    );
    for (const url of ["http://127.0.0.1:3000/", "http://localhost:3000/"]) {
      void fetch(url).then(
        (response) =>
          console.error(
            "[DEBUG-windows-dev] probe",
            JSON.stringify({ url, status: response.status }),
          ),
        (error) =>
          console.error(
            "[DEBUG-windows-dev] probe",
            JSON.stringify({ url, error: String(error) }),
          ),
      );
    }
  }, 5_000).unref();

  return { children, stop: stopChildren };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) startDevCoordinator();
