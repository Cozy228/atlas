import { describe, expect, it, vi } from "vitest";
import { VERIFY_BEACON_PATH, fireVerifyBeacon, verifyBeaconRequest } from "./verifyBeacon";

/**
 * D5 (client) — the citation-follow beacon the brief page's citation links fire.
 * The portal vitest env is `node` (no DOM), so this drives the exact fire helper
 * the onClick calls: it POSTs the right shape to the beacon endpoint and never
 * throws. The real click is exercised by e2e.
 */

describe("verify beacon client (D5)", () => {
  it("builds the beacon POST request shape", () => {
    const request = verifyBeaconRequest({ moment: "adopt", sourceId: "src", msSinceRender: 900 });
    expect(request).toEqual({
      url: VERIFY_BEACON_PATH,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ moment: "adopt", sourceId: "src", msSinceRender: 900 }),
    });
  });

  it("fires a keepalive POST to the beacon endpoint", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    fireVerifyBeacon({ moment: "build", sourceId: "src-2", msSinceRender: 42 }, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(VERIFY_BEACON_PATH);
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({
      moment: "build",
      sourceId: "src-2",
      msSinceRender: 42,
    });
  });

  it("never throws when fetch rejects or is unavailable", () => {
    const rejecting = vi.fn().mockRejectedValue(new Error("network down"));
    expect(() =>
      fireVerifyBeacon({ moment: "adopt", sourceId: "s", msSinceRender: 0 }, rejecting),
    ).not.toThrow();
    expect(() =>
      fireVerifyBeacon({ moment: "adopt", sourceId: "s", msSinceRender: 0 }, undefined),
    ).not.toThrow();
  });
});
