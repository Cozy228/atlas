import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { findAvailablePort, packageManagerCommand } from "./dev-ports.mjs";

const servers = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

describe("findAvailablePort", () => {
  it("moves past a port that is already in use", async () => {
    const server = createServer();
    servers.push(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");

    await expect(findAvailablePort(address.port)).resolves.toBeGreaterThan(address.port);
  });
});

describe("packageManagerCommand", () => {
  it("executes native binaries without parsing them as JavaScript", () => {
    const invocation = packageManagerCommand(process.execPath, ["--version"]);
    const result = spawnSync(invocation.command, invocation.args, { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(process.version);
  });

  it("runs JavaScript package-manager entries with Node and preserves arguments", () => {
    const directory = mkdtempSync(join(tmpdir(), "atlas-pnpm-"));
    try {
      const entry = join(directory, "package manager.cjs");
      writeFileSync(entry, "process.stdout.write(JSON.stringify(process.argv.slice(2)))");
      const args = ["run", "/^dev:(client|server)$/"];
      const invocation = packageManagerCommand(entry, args);
      const result = spawnSync(invocation.command, invocation.args, { encoding: "utf8" });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(args);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});
