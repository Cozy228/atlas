import { describe, expect, it, vi } from "vitest";

import { createGracefulShutdown } from "./gracefulShutdown";

describe("graceful shutdown", () => {
  it("marks draining, closes the listener and hooks once, and is idempotent", async () => {
    const events: string[] = [];
    const server = {
      close: vi.fn((callback: (error?: Error) => void) => {
        events.push("server-close");
        callback();
        return server;
      }),
      closeIdleConnections: vi.fn(() => {
        events.push("idle-close");
      }),
      closeAllConnections: vi.fn(),
    };
    const closeHook = vi.fn(() => {
      events.push("hook-close");
    });
    const coordinator = createGracefulShutdown({
      server,
      deadlineMs: 1_000,
      markDraining: () => events.push("draining"),
      closeHooks: [closeHook],
    });

    const first = coordinator.shutdown("SIGTERM");
    const second = coordinator.shutdown("SIGINT");

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ forced: false, signal: "SIGTERM" });
    expect(events).toEqual(["draining", "server-close", "hook-close", "idle-close"]);
    expect(server.close).toHaveBeenCalledOnce();
    expect(closeHook).toHaveBeenCalledOnce();
    expect(server.closeAllConnections).not.toHaveBeenCalled();
  });

  it("force-closes connections after the deadline", async () => {
    vi.useFakeTimers();
    const server = {
      close: vi.fn(() => server),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };
    const coordinator = createGracefulShutdown({
      server,
      deadlineMs: 25_000,
      markDraining: vi.fn(),
      closeHooks: [() => new Promise<void>(() => {})],
    });

    const result = coordinator.shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(25_000);

    await expect(result).resolves.toEqual({ forced: true, signal: "SIGTERM" });
    expect(server.closeIdleConnections).toHaveBeenCalledOnce();
    expect(server.closeAllConnections).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("waits for active requests before closing shared resources", async () => {
    let finishServerClose: ((error?: Error) => void) | undefined;
    const closeHook = vi.fn();
    const server = {
      close: vi.fn((callback: (error?: Error) => void) => {
        finishServerClose = callback;
        return server;
      }),
    };
    const coordinator = createGracefulShutdown({
      server,
      deadlineMs: 1_000,
      markDraining: vi.fn(),
      closeHooks: [closeHook],
    });

    const shutdown = coordinator.shutdown("SIGTERM");
    await Promise.resolve();
    expect(closeHook).not.toHaveBeenCalled();

    finishServerClose?.();
    await expect(shutdown).resolves.toEqual({ forced: false, signal: "SIGTERM" });
    expect(closeHook).toHaveBeenCalledOnce();
  });
});
