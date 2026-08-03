import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const discovery = vi.hoisted(() => ({
  discoverGuardrails: vi.fn(),
  discoverServiceSources: vi.fn(),
}));

vi.mock("./discovery/discoverGuardrails", () => ({
  discoverGuardrails: discovery.discoverGuardrails,
}));

vi.mock("./discovery/discoverSources", () => ({
  discoverServiceSources: discovery.discoverServiceSources,
}));

import { createDefaultContextService } from "./composition";

beforeEach(() => {
  discovery.discoverGuardrails.mockReset();
  discovery.discoverServiceSources.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("default context discovery lifecycle", () => {
  it("starts the independent service and guardrail discovery passes concurrently", async () => {
    let resolveServices!: (value: []) => void;
    let resolveGuardrails!: (value: []) => void;
    discovery.discoverServiceSources.mockImplementation(
      () => new Promise<[]>((resolve) => (resolveServices = resolve)),
    );
    discovery.discoverGuardrails.mockImplementation(
      () => new Promise<[]>((resolve) => (resolveGuardrails = resolve)),
    );

    const service = createDefaultContextService({
      env: { CONFLUENCE_SECURITY_SPACE_KEY: "parallel-test" },
    });

    await vi.waitFor(() => {
      expect(discovery.discoverServiceSources).toHaveBeenCalledTimes(1);
      expect(discovery.discoverGuardrails).toHaveBeenCalledTimes(1);
    });
    resolveServices([]);
    resolveGuardrails([]);

    await expect(service).resolves.toBeDefined();
  });

  it("does not permanently memoize a failed discovery pass", async () => {
    discovery.discoverServiceSources
      .mockRejectedValueOnce(new Error("temporary source failure"))
      .mockResolvedValueOnce([]);
    discovery.discoverGuardrails.mockResolvedValue([]);
    const env = { CONFLUENCE_SECURITY_SPACE_KEY: "retry-test" };

    await expect(createDefaultContextService({ env })).rejects.toThrow("temporary source failure");
    await expect(createDefaultContextService({ env })).resolves.toBeDefined();

    expect(discovery.discoverServiceSources).toHaveBeenCalledTimes(2);
  });

  it("refreshes derived discovery after the source validation window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T00:00:00.000Z"));
    discovery.discoverServiceSources.mockResolvedValue([]);
    discovery.discoverGuardrails.mockResolvedValue([]);
    const env = {
      CACHE_VALIDATION_TTL_SECONDS: "1",
      CONFLUENCE_SECURITY_SPACE_KEY: "expiry-test",
    };

    await createDefaultContextService({ env });
    vi.setSystemTime(new Date("2026-08-03T00:00:00.999Z"));
    await createDefaultContextService({ env });
    expect(discovery.discoverServiceSources).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-08-03T00:00:01.001Z"));
    await createDefaultContextService({ env });
    expect(discovery.discoverServiceSources).toHaveBeenCalledTimes(2);
  });
});
