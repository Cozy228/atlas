import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { findAvailablePort } from "./dev-ports.mjs";

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
