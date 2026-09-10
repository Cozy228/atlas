import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function findAvailablePort(startPort) {
  for (let port = startPort; port <= 65_535; port += 1) {
    if (await isAvailable(port)) return port;
  }
  throw new Error(`No available port found at or above ${startPort}`);
}

async function isAvailable(port) {
  return (await isHostAvailable(port, "127.0.0.1")) && (await isHostAvailable(port, "::1"));
}

async function isHostAvailable(port, host) {
  return new Promise((resolveAvailability, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") resolveAvailability(false);
      else if (host === "::1" && error.code === "EADDRNOTAVAIL") resolveAvailability(true);
      else reject(error);
    });
    server.listen(port, host, () => server.close(() => resolveAvailability(true)));
  });
}

export function packageManagerCommand(execPath, args) {
  return [".js", ".cjs", ".mjs"].includes(extname(execPath))
    ? { command: process.execPath, args: [execPath, ...args] }
    : { command: execPath, args };
}

async function main() {
  const clientPort = await findAvailablePort(3000);
  const serverPort = await findAvailablePort(clientPort + 1);
  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) throw new Error("Start the portal with pnpm dev.");

  console.log(`Atlas dev ports: client ${clientPort}, server ${serverPort}`);
  const invocation = packageManagerCommand(npmExecPath, ["run", "/^dev:(client|server)$/"]);
  const child = spawn(invocation.command, invocation.args, {
    cwd: resolve(import.meta.dirname, ".."),
    env: {
      ...process.env,
      ATLAS_DEV_CLIENT_PORT: String(clientPort),
      ATLAS_DEV_SERVER_PORT: String(serverPort),
    },
    stdio: "inherit",
  });
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) await main();
