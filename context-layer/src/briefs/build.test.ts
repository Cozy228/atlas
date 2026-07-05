import { describe, expect, it } from "vitest";
import { deriveGraph } from "../graph/deriveGraph";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "../graph/rootIds";
import type { RootSnapshot } from "../graph/graphTypes";
import { buildTemplate } from "./templates";
import type { BriefScope } from "./briefTypes";

/**
 * D5 — the build template is the "my context" join for the situation's DECLARED
 * services (M5): one subject per declared service, the fan-out following the data
 * (a service with N modules shows N — no numeric budget). It never re-serves what
 * the agent can discover itself (P28); it delivers the join. Public-safe
 * fictional data.
 *
 * Red in Batch 0: `buildTemplate` throws `unimplemented`. Green at Batch 3.
 */

const AT = "2026-07-05T10:00:00.000Z";

function snapshots(): RootSnapshot[] {
  return [
    {
      rootId: availabilityRootId("zone-alpha"),
      resolvedAt: AT,
      contractVersion: "availability-v1",
      parse: {
        kind: "availability",
        landingZoneId: "zone-alpha",
        landingZoneName: "Alpha",
        services: [
          { slug: "cloudx/parser", name: "Parser", domain: "AI" },
          { slug: "cloudx/ledger", name: "Ledger", domain: "Finance" },
        ],
      },
    },
    {
      rootId: TERRAFORM_ROOT_ID,
      resolvedAt: AT,
      contractVersion: "terraform-v1",
      parse: {
        kind: "terraform",
        modules: [
          {
            serviceSlug: "cloudx/parser",
            address: "acme/parser/cloudx",
            name: "parser",
            version: "1.2.0",
          },
          {
            serviceSlug: "cloudx/ledger",
            address: "acme/ledger/cloudx",
            name: "ledger",
            version: "2.5.0",
          },
        ],
      },
    },
    {
      rootId: SECURITY_ROOT_ID,
      resolvedAt: AT,
      contractVersion: "security-v1",
      parse: { kind: "security", guardrails: [{ slug: "data-residency", name: "Data Residency" }] },
    },
  ];
}

// The situation declares TWO services in use; build joins both.
const SCOPE: BriefScope = {
  landingZoneIds: ["zone-alpha"],
  serviceSlugs: ["cloudx/parser", "cloudx/ledger"],
};

describe("build template (D5)", () => {
  it("joins every declared service in the situation", () => {
    const requests = buildTemplate(deriveGraph(snapshots()), SCOPE);
    const subjectServices = new Set(
      requests
        .filter((request) => request.subject.kind === "service")
        .map((request) => request.subject.id),
    );
    expect(subjectServices).toEqual(new Set(["cloudx/parser", "cloudx/ledger"]));
  });

  it("plans at least one block per declared service (no service silently dropped)", () => {
    const requests = buildTemplate(deriveGraph(snapshots()), SCOPE);
    for (const slug of SCOPE.serviceSlugs) {
      expect(requests.some((request) => request.subject.id === slug)).toBe(true);
    }
  });

  it("does not fabricate a subject outside the declared services", () => {
    const requests = buildTemplate(deriveGraph(snapshots()), SCOPE);
    const stray = requests.filter(
      (request) =>
        request.subject.kind === "service" && !SCOPE.serviceSlugs.includes(request.subject.id),
    );
    expect(stray).toEqual([]);
  });
});
