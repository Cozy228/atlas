import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_GRAPH_REFRESH_INTERVAL_MS,
  resolveGraphRefreshGate,
  scheduleGraphRefresh,
  type ScheduleTimers,
} from "./graphRefreshSchedule";

/**
 * Item A — the lifecycle-plane refresh schedule. These prove the GATE (when the
 * periodic `refreshGraphSnapshots` pass runs) and the SCHEDULE primitive (timers
 * created + unref'd, a failing pass never throws), with the refresh function
 * injected — no Nitro runtime, no real timers, no network.
 */
describe("resolveGraphRefreshGate", () => {
  // Real creds so `shouldMockData` reads live; the interval env is set per case.
  const live = {
    DEV_MOCKS: "0",
    CONFLUENCE_TOKEN: "tok",
    CONFLUENCE_BASE_URL: "https://confluence.example",
  } as const;

  it("NODE_ENV=test ⇒ no timer", () => {
    const gate = resolveGraphRefreshGate({
      ...live,
      NODE_ENV: "test",
      GRAPH_REFRESH_INTERVAL_MS: "60000",
    });
    expect(gate.enabled).toBe(false);
  });

  it("VITEST set ⇒ no timer", () => {
    const gate = resolveGraphRefreshGate({
      ...live,
      VITEST: "true",
      GRAPH_REFRESH_INTERVAL_MS: "60000",
    });
    expect(gate.enabled).toBe(false);
  });

  it("DEV_MOCKS mock mode ⇒ no timer (would only crawl MSW)", () => {
    // No creds and no override ⇒ shouldMockData() is true ⇒ mock mode.
    const gate = resolveGraphRefreshGate({ GRAPH_REFRESH_INTERVAL_MS: "60000" });
    expect(gate.enabled).toBe(false);
    // Explicit force-mock is also gated even with real creds present.
    expect(
      resolveGraphRefreshGate({ ...live, DEV_MOCKS: "1", GRAPH_REFRESH_INTERVAL_MS: "60000" })
        .enabled,
    ).toBe(false);
  });

  it("interval absent ⇒ no timer (opt-in)", () => {
    expect(resolveGraphRefreshGate(live).enabled).toBe(false);
  });

  it("interval 0 / negative / non-numeric ⇒ no timer", () => {
    expect(resolveGraphRefreshGate({ ...live, GRAPH_REFRESH_INTERVAL_MS: "0" }).enabled).toBe(
      false,
    );
    expect(resolveGraphRefreshGate({ ...live, GRAPH_REFRESH_INTERVAL_MS: "-5" }).enabled).toBe(
      false,
    );
    expect(resolveGraphRefreshGate({ ...live, GRAPH_REFRESH_INTERVAL_MS: "soon" }).enabled).toBe(
      false,
    );
  });

  it("positive interval in a live runtime ⇒ scheduled at that cadence", () => {
    const gate = resolveGraphRefreshGate({ ...live, GRAPH_REFRESH_INTERVAL_MS: "60000" });
    expect(gate).toEqual({ enabled: true, intervalMs: 60000 });
  });

  it("exposes a 15-minute recommended cadence constant", () => {
    expect(DEFAULT_GRAPH_REFRESH_INTERVAL_MS).toBe(15 * 60 * 1000);
  });
});

describe("scheduleGraphRefresh", () => {
  /** A timer seam that captures callbacks (never fires them) + records unref. */
  function fakeTimers() {
    const handles: { timeout: number; interval: number; unref: number } = {
      timeout: 0,
      interval: 0,
      unref: 0,
    };
    let timeoutCb: (() => void) | undefined;
    let intervalCb: (() => void) | undefined;
    const mkHandle = () => ({ unref: () => (handles.unref += 1) });
    const timers: ScheduleTimers = {
      setTimeout: (cb) => {
        handles.timeout += 1;
        timeoutCb = cb;
        return mkHandle();
      },
      setInterval: (cb) => {
        handles.interval += 1;
        intervalCb = cb;
        return mkHandle();
      },
      clearTimeout: () => (handles.timeout -= 1),
      clearInterval: () => (handles.interval -= 1),
    };
    return {
      timers,
      handles,
      fireTimeout: () => timeoutCb?.(),
      fireInterval: () => intervalCb?.(),
    };
  }

  const silentLog = { info: vi.fn(), warn: vi.fn() };

  it("registers an initial timeout + a repeating interval, both unref'd", () => {
    const { timers, handles } = fakeTimers();
    scheduleGraphRefresh({
      intervalMs: 60000,
      refresh: async () => ({ events: 0, aging: [] }),
      log: silentLog,
      timers,
    });
    expect(handles.timeout).toBe(1);
    expect(handles.interval).toBe(1);
    expect(handles.unref).toBe(2); // both timers unref'd so shutdown never blocks
  });

  it("runs the pass on the initial tick and logs completion", async () => {
    const { timers, fireTimeout } = fakeTimers();
    const refresh = vi.fn(async () => ({ events: 2, aging: [] }));
    const log = { info: vi.fn(), warn: vi.fn() };
    scheduleGraphRefresh({ intervalMs: 60000, refresh, log, timers });

    fireTimeout();
    await vi.waitFor(() => expect(log.info).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("a failing pass is logged and never throws — the next tick just retries", async () => {
    const { timers, fireTimeout, fireInterval } = fakeTimers();
    const refresh = vi.fn(async () => {
      throw new Error("terraform probe timed out");
    });
    const log = { info: vi.fn(), warn: vi.fn() };
    scheduleGraphRefresh({ intervalMs: 60000, refresh, log, timers });

    expect(() => fireTimeout()).not.toThrow();
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled());
    expect(() => fireInterval()).not.toThrow();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });

  it("stop() clears both timers", () => {
    const { timers, handles } = fakeTimers();
    const handle = scheduleGraphRefresh({
      intervalMs: 60000,
      refresh: async () => ({ events: 0, aging: [] }),
      log: silentLog,
      timers,
    });
    handle.stop();
    expect(handles.timeout).toBe(0);
    expect(handles.interval).toBe(0);
  });
});
