import { describe, expect, it } from "vitest";
import { normalizeServiceIdentity } from "./serviceIdentityNormalizer";

describe("normalizeServiceIdentity", () => {
  it("forms the canonical {provider}/{id} key from the spine tuple alone", () => {
    const identity = normalizeServiceIdentity({
      provider: "aws",
      id: "textract",
      name: "Amazon Textract",
    });
    expect(identity.key).toBe("aws/textract");
  });

  it("strips the vendor prefix to recover the bare product name in both tiers", () => {
    const identity = normalizeServiceIdentity({
      provider: "aws",
      id: "textract",
      name: "Amazon Textract",
    });
    expect(identity.recallAliases).toContain("amazon textract");
    expect(identity.recallAliases).toContain("textract");
    expect(identity.admissionAliases).toContain("amazon textract");
    expect(identity.admissionAliases).toContain("textract");
  });

  it("keeps the bare machine slug recall-eligible but NEVER admission-eligible (B8/B9)", () => {
    // id "dms" reads like an abbreviation, but it IS the machine slug, so it must
    // not gate admission — only the full product name does.
    const identity = normalizeServiceIdentity({
      provider: "aws",
      id: "dms",
      name: "Database Migration Service",
    });
    expect(identity.recallAliases).toContain("dms");
    expect(identity.admissionAliases).not.toContain("dms");
    expect(identity.admissionAliases).toContain("database migration service");
  });

  it("treats a parenthetical as an explicit, admission-eligible abbreviation", () => {
    const identity = normalizeServiceIdentity({
      provider: "aws",
      id: "efs",
      name: "Elastic File System (EFS)",
    });
    expect(identity.admissionAliases).toContain("efs");
    expect(identity.admissionAliases).toContain("elastic file system");
  });

  it("expands a multi-word slug into space-separated recall words", () => {
    const identity = normalizeServiceIdentity({
      provider: "aws",
      id: "api-gateway",
      name: "API Gateway",
    });
    expect(identity.recallAliases).toContain("api gateway");
    // No vendor prefix to strip — admission still carries the product name.
    expect(identity.admissionAliases).toContain("api gateway");
  });
});
