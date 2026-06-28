import { describe, expect, it } from "vitest";
import type { ServiceIdentity } from "@atlas/schema";
import { createDevReferenceDiscovery } from "./referenceDiscovery";

function identity(key: string): ServiceIdentity {
  const [provider, id] = key.split("/");
  return { provider, id, name: id, key, recallAliases: [id], admissionAliases: [id] };
}

describe("createDevReferenceDiscovery (plan 017 B7)", () => {
  const discovery = createDevReferenceDiscovery();

  it("returns in-code reference-only links for a known service, spanning doc_types", async () => {
    const result = await discovery.discover(identity("aws/textract"));

    expect(result.references.length).toBeGreaterThan(0);
    expect(new Set(result.references.map((r) => r.doc_type))).toEqual(
      new Set(["design", "user-guide", "policy"]),
    );
    expect(result.status).toBe("fresh");
    expect(result.incomplete).toBe(false);
  });

  it("marks every reference honestly as reference-only and agent-not-readable", async () => {
    const result = await discovery.discover(identity("aws/s3"));
    expect(result.references.length).toBeGreaterThan(0);
    for (const reference of result.references) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.access_mode).toBe("service_credentials");
      expect(reference.agent_accessible).toBe(false);
    }
  });

  it("returns an honest empty list for an unknown service (never a fabricated link)", async () => {
    const result = await discovery.discover(identity("aws/not-a-real-service"));
    expect(result.references).toEqual([]);
    expect(result.status).toBe("fresh");
    expect(result.incomplete).toBe(false);
  });
});
