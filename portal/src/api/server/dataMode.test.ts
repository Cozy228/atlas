import { describe, expect, it } from "vitest";

import { shouldMockData } from "../../../server/devMocks/shouldMock";

/**
 * The mock/live predicate is the ONE source of truth behind both the MSW boot
 * (server/devMocks/start.ts) and the data-mode badge (dataMode.ts). These cases
 * pin the three-state seam contract (plan 026).
 */
describe("shouldMockData", () => {
  it("forces mock when DEV_MOCKS=1, even with real creds present (hermetic E2E)", () => {
    expect(shouldMockData({ DEV_MOCKS: "1" })).toBe(true);
    expect(
      shouldMockData({ DEV_MOCKS: "1", CONFLUENCE_TOKEN: "t", CONFLUENCE_BASE_URL: "u" }),
    ).toBe(true);
  });

  it("forces real when DEV_MOCKS=0, even with no creds (debug the real path)", () => {
    expect(shouldMockData({ DEV_MOCKS: "0" })).toBe(false);
    expect(
      shouldMockData({ DEV_MOCKS: "0", CONFLUENCE_TOKEN: "t", CONFLUENCE_BASE_URL: "u" }),
    ).toBe(false);
  });

  it("auto-mocks with no override and no creds (zero-config onboarding)", () => {
    expect(shouldMockData({})).toBe(true);
  });

  it("goes live when both real Confluence creds are present and no override", () => {
    expect(shouldMockData({ CONFLUENCE_TOKEN: "t", CONFLUENCE_BASE_URL: "u" })).toBe(false);
  });

  it("stays mock when creds are only partially set (incomplete = not real)", () => {
    expect(shouldMockData({ CONFLUENCE_TOKEN: "t" })).toBe(true);
    expect(shouldMockData({ CONFLUENCE_BASE_URL: "u" })).toBe(true);
  });

  it("treats a non-1/0 DEV_MOCKS (empty string, 'false') as NO override → auto-detect", () => {
    // Only the literals '1'/'0' are overrides; everything else falls through to
    // creds auto-detect, so a stray `DEV_MOCKS=` never silently forces mock.
    expect(shouldMockData({ DEV_MOCKS: "" })).toBe(true); // no creds → auto-mock
    expect(shouldMockData({ DEV_MOCKS: "", CONFLUENCE_TOKEN: "t", CONFLUENCE_BASE_URL: "u" })).toBe(
      false,
    ); // real creds → live (NOT forced mock by the empty value)
    expect(
      shouldMockData({ DEV_MOCKS: "false", CONFLUENCE_TOKEN: "t", CONFLUENCE_BASE_URL: "u" }),
    ).toBe(false);
  });
});
