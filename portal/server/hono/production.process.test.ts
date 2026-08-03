import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest, Agent } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const fixturePath = fileURLToPath(new URL("./productionProcess.fixture.ts", import.meta.url));
const children = new Set<ChildProcess>();
const temporaryDirectories = new Set<string>();

afterEach(async () => {
  const pendingExits: Array<Promise<void>> = [];
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    pendingExits.push(
      new Promise((resolve) => {
        child.once("exit", () => resolve());
        child.kill("SIGKILL");
      }),
    );
  }
  await Promise.all(pendingExits);
  children.clear();
  await Promise.all(
    [...temporaryDirectories].map((directory) => rm(directory, { recursive: true })),
  );
  temporaryDirectories.clear();
});

describe("production process lifecycle", () => {
  it("exits zero after an idle SIGTERM", async () => {
    const process = await startProductionProcess();
    await process.waitForEvent("ready");

    process.child.kill("SIGTERM");

    await expect(process.exit).resolves.toMatchObject({ code: 0, signal: null });
    expect(process.eventNames()).toEqual(
      expect.arrayContaining(["ready", "drain-start", "drain-complete"]),
    );
    expect(process.eventNames()).not.toContain("drain-deadline");
  });

  it("closes an idle keep-alive connection during SIGTERM drain", async () => {
    const process = await startProductionProcess();
    const ready = await process.waitForEvent("ready");
    const connection = await openIdleKeepAliveConnection(Number(ready.port));
    expect(connection.status).toBe(200);

    process.child.kill("SIGTERM");
    const drainStart = await process.waitForEvent("drain-start");

    expect(drainStart.activeRequests).toBe(0);
    await expect(process.exit).resolves.toMatchObject({ code: 0, signal: null });
    expect(process.eventNames()).toEqual(expect.arrayContaining(["drain-start", "drain-complete"]));
    connection.close();
  });

  it("emits sanitized structured request logs", async () => {
    const process = await startProductionProcess();
    const ready = await process.waitForEvent("ready");

    const response = await fetch(
      `http://127.0.0.1:${String(ready.port)}/health?token=query-secret`,
      {
        headers: {
          authorization: "Bearer authorization-secret",
          cookie: "session=cookie-secret",
          "x-request-id": "production-request-123",
        },
      },
    );
    const event = await process.waitForEvent("request");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("production-request-123");
    expect(event).toMatchObject({
      event: "request",
      requestId: "production-request-123",
      method: "GET",
      path: "/health",
      status: 200,
      latencyMs: expect.any(Number),
      aborted: false,
    });
    expect(JSON.stringify(event)).not.toMatch(
      /query-secret|authorization-secret|cookie-secret|token|authorization|cookie/i,
    );

    process.child.kill("SIGTERM");
    await expect(process.exit).resolves.toMatchObject({ code: 0, signal: null });
  });

  it.each([
    {
      label: "API",
      path: "/api/feedback",
      body: "{}",
      expectedStatus: 400,
    },
    {
      label: "MCP",
      path: "/mcp",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
      expectedStatus: 200,
    },
  ])("lets an active $label POST on a keep-alive connection finish", async (testCase) => {
    const process = await startProductionProcess();
    const ready = await process.waitForEvent("ready");
    const pendingRequest = beginPartialJsonRequest(
      Number(ready.port),
      testCase.path,
      testCase.body,
    );
    await delay(100);

    process.child.kill("SIGTERM");
    const drainStart = await process.waitForEvent("drain-start");
    expect(drainStart.activeRequests).toBe(1);

    pendingRequest.finish();
    await expect(pendingRequest.response).resolves.toMatchObject({
      status: testCase.expectedStatus,
    });
    pendingRequest.close();
    await expect(process.exit).resolves.toMatchObject({ code: 0, signal: null });
    expect(process.eventNames()).toContain("drain-complete");
  });

  it("force-closes a blocked active POST at the shutdown deadline", async () => {
    const process = await startProductionProcess({ shutdownTimeoutMs: 100 });
    const ready = await process.waitForEvent("ready");
    const pendingRequest = beginPartialJsonRequest(
      Number(ready.port),
      "/mcp",
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    );
    void pendingRequest.response.catch(() => undefined);
    await delay(100);

    process.child.kill("SIGTERM");
    const drainStart = await process.waitForEvent("drain-start");
    expect(drainStart.activeRequests).toBe(1);
    await process.waitForEvent("drain-deadline");

    await expect(process.exit).resolves.toMatchObject({ code: 1, signal: null });
    pendingRequest.close();
  });

  it.each([
    ["PORT", "not-a-port"],
    ["PORT", "0"],
    ["PORT", "65536"],
    ["SHUTDOWN_TIMEOUT_MS", "not-a-timeout"],
    ["SHUTDOWN_TIMEOUT_MS", "0"],
  ])("rejects invalid %s=%s before listening", async (name, value) => {
    const process = await startProductionProcess({ env: { [name]: value } });

    const result = await process.exit;
    expect(result.code).not.toBe(0);
    expect(process.eventNames()).not.toContain("ready");
    expect(process.stderr).toContain(`${name} must be a positive integer`);
  });

  it("exits nonzero before listening when the asset manifest is corrupt", async () => {
    const artifact = await createArtifactFixture("{");
    const process = await startProductionProcess({ serverRoot: artifact.serverRoot });

    const result = await process.exit;
    expect(result.code).not.toBe(0);
    expect(process.eventNames()).not.toContain("ready");
    expect(process.stderr).toContain("SyntaxError");
  });
});

async function startProductionProcess(
  options: {
    env?: Record<string, string>;
    serverRoot?: string;
    shutdownTimeoutMs?: number;
  } = {},
): Promise<ObservedProcess> {
  const artifact = options.serverRoot ? undefined : await createArtifactFixture();
  const port = await availablePort();
  const child = spawn(process.execPath, ["--import", "tsx", fixturePath], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    env: {
      ...process.env,
      ATLAS_TEST_SERVER_ROOT: options.serverRoot ?? artifact?.serverRoot,
      NODE_ENV: "production",
      PORT: String(port),
      SHUTDOWN_TIMEOUT_MS: String(options.shutdownTimeoutMs ?? 2_000),
      ...options.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  return new ObservedProcess(child);
}

class ObservedProcess {
  readonly child: ChildProcess;
  readonly exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  stderr = "";
  #events: Array<Record<string, unknown>> = [];
  #stdoutBuffer = "";

  constructor(child: ChildProcess) {
    this.child = child;
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => this.#onStdout(chunk));
    child.stderr?.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    this.exit = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
  }

  eventNames(): string[] {
    return this.#events.map((event) => String(event.event));
  }

  async waitForEvent(name: string, timeoutMs = 5_000): Promise<Record<string, unknown>> {
    const existing = this.#events.find((event) => event.event === name);
    if (existing) return existing;

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await delay(10);
      const event = this.#events.find((candidate) => candidate.event === name);
      if (event) return event;
      if (this.child.exitCode !== null || this.child.signalCode !== null) break;
    }
    throw new Error(
      `Timed out waiting for ${name}; events=${JSON.stringify(this.#events)} stderr=${this.stderr}`,
    );
  }

  #onStdout(chunk: string): void {
    this.#stdoutBuffer += chunk;
    const lines = this.#stdoutBuffer.split("\n");
    this.#stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      try {
        this.#events.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // Production lifecycle logs are JSON; unrelated output is ignored by this observer.
      }
    }
  }
}

function beginPartialJsonRequest(
  port: number,
  path: string,
  body: string,
): {
  finish(): void;
  close(): void;
  response: Promise<{ status: number | undefined; body: string }>;
} {
  const agent = new Agent({ keepAlive: true });
  let finishResponse: ((value: { status: number | undefined; body: string }) => void) | undefined;
  let failResponse: ((error: Error) => void) | undefined;
  const response = new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
    finishResponse = resolve;
    failResponse = reject;
  });
  const request = httpRequest({
    agent,
    host: "127.0.0.1",
    port,
    path,
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      connection: "keep-alive",
      "content-length": Buffer.byteLength(body),
      "content-type": "application/json",
    },
  });
  request.once("error", (error) => failResponse?.(error));
  request.once("response", (incoming) => {
    incoming.setEncoding("utf8");
    let responseBody = "";
    incoming.on("data", (chunk: string) => {
      responseBody += chunk;
    });
    incoming.once("end", () =>
      finishResponse?.({ status: incoming.statusCode, body: responseBody }),
    );
  });
  request.write(body.slice(0, 1));

  return {
    finish: () => request.end(body.slice(1)),
    close: () => {
      request.destroy();
      agent.destroy();
    },
    response,
  };
}

async function openIdleKeepAliveConnection(
  port: number,
): Promise<{ status: number | undefined; close(): void }> {
  const agent = new Agent({ keepAlive: true });
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest({
      agent,
      host: "127.0.0.1",
      port,
      path: "/health",
      headers: { connection: "keep-alive" },
    });
    request.once("error", reject);
    request.once("response", (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    request.end();
  });
  return { status, close: () => agent.destroy() };
}

async function createArtifactFixture(manifestText?: string): Promise<{ serverRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), "atlas-hono-process-"));
  temporaryDirectories.add(root);
  const serverRoot = join(root, ".output", "server");
  const publicRoot = join(root, ".output", "public");
  await mkdir(serverRoot, { recursive: true });
  await mkdir(publicRoot, { recursive: true });
  const document = "<!doctype html><div id=app></div>";
  await writeFile(join(publicRoot, "index.html"), document);
  await writeFile(
    join(serverRoot, "assets-manifest.json"),
    manifestText ??
      JSON.stringify({
        version: 1,
        assets: {
          "/index.html": {
            mime: "text/html; charset=utf-8",
            cacheControl: "no-cache",
            lastModified: "Fri, 01 Aug 2026 00:00:00 GMT",
            identity: {
              file: "index.html",
              size: Buffer.byteLength(document),
              etag: '"index"',
            },
          },
        },
      }),
  );
  return { serverRoot };
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate a test port.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
