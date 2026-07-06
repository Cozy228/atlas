import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleVerifyBeacon } from "./instrumentsRoute";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { logger } from "../observability/logging";
import { resetMetrics, snapshot } from "../observability/metrics";

/**
 * D5 (server) — the citation-follow beacon (P28 verification tax, locked decision
 * 6). A valid, shape-checked body increments the counter + observes the latency
 * histogram + logs, stores NOTHING durable, and returns 204. An invalid body is a
 * 400 with no metric recorded.
 */

beforeEach(() => resetMetrics());

describe("verify beacon (D5)", () => {
  it("valid POST ⇒ 204 + counter + histogram + log, no body", () => {
    const spy = vi.spyOn(logger("instruments"), "info");
    const result = handleVerifyBeacon({ moment: "adopt", sourceId: "src-1", msSinceRender: 1200 });

    expect(result.status).toBe(204);
    expect(result.body).toBeUndefined();

    const follow = snapshot().counters.find(
      (c) => c.name === "citation_follow" && c.labels.moment === "adopt",
    );
    expect(follow?.value).toBe(1);

    const latency = snapshot().histograms.find(
      (h) => h.name === "citation_follow_ms" && h.labels.moment === "adopt",
    );
    expect(latency?.count).toBe(1);
    expect(latency?.sum).toBe(1200);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("no durable write: the beacon touches no repository", async () => {
    const before = (await sharedEventsRepository(process.env).listSince()).length;
    handleVerifyBeacon({ moment: "change", sourceId: "src-2", msSinceRender: 10 });
    const after = (await sharedEventsRepository(process.env).listSince()).length;
    expect(after).toBe(before);
  });

  it("invalid POST ⇒ 400, no metric recorded", () => {
    const result = handleVerifyBeacon({ moment: "not-a-moment", sourceId: "", msSinceRender: -1 });
    expect(result.status).toBe(400);
    expect(result.body?.error.code).toBe("invalid_request");
    expect(snapshot().counters.some((c) => c.name === "citation_follow")).toBe(false);
  });
});
