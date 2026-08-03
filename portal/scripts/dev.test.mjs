import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { startDevCoordinator } from "./dev.mjs";

class FakeRuntime extends EventEmitter {
  env = {};
  execPath = "/tools/node";
  exitCode = undefined;
}

function createChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn(() => true);
  return child;
}

function exitChild(child, code, signal = null) {
  child.exitCode = code;
  child.signalCode = signal;
  child.emit("exit", code, signal);
}

describe("portal dev coordinator", () => {
  it("spawns Vite and tsx directly through the active Node runtime", () => {
    const runtime = new FakeRuntime();
    const children = [createChild(), createChild()];
    const spawnChild = vi.fn().mockReturnValueOnce(children[0]).mockReturnValueOnce(children[1]);

    startDevCoordinator({
      runtime,
      spawnChild,
      cwd: "/portal",
      cliPaths: { vite: "/tools/vite.js", tsx: "/tools/tsx.mjs" },
    });

    expect(spawnChild).toHaveBeenNthCalledWith(
      1,
      "/tools/node",
      ["/tools/vite.js", "dev"],
      expect.objectContaining({ cwd: "/portal", stdio: "inherit" }),
    );
    expect(spawnChild).toHaveBeenNthCalledWith(
      2,
      "/tools/node",
      ["/tools/tsx.mjs", "watch", "server/hono/dev.ts"],
      expect.objectContaining({ cwd: "/portal", stdio: "inherit" }),
    );
  });

  it("terminates the sibling and preserves the first child exit code", () => {
    const runtime = new FakeRuntime();
    const children = [createChild(), createChild()];
    const spawnChild = vi.fn().mockReturnValueOnce(children[0]).mockReturnValueOnce(children[1]);

    startDevCoordinator({ runtime, spawnChild, cwd: "/portal" });
    exitChild(children[0], 7);

    expect(children[1].kill).toHaveBeenCalledWith("SIGTERM");
    exitChild(children[1], null, "SIGTERM");
    expect(runtime.exitCode).toBe(7);
  });

  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ])("forwards %s to both children", (signal, exitCode) => {
    const runtime = new FakeRuntime();
    const children = [createChild(), createChild()];
    const spawnChild = vi.fn().mockReturnValueOnce(children[0]).mockReturnValueOnce(children[1]);

    startDevCoordinator({ runtime, spawnChild, cwd: "/portal" });
    runtime.emit(signal);

    expect(children[0].kill).toHaveBeenCalledWith(signal);
    expect(children[1].kill).toHaveBeenCalledWith(signal);
    exitChild(children[0], null, signal);
    exitChild(children[1], null, signal);
    expect(runtime.exitCode).toBe(exitCode);
  });
});
