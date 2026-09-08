import { describe, expect, it } from "vitest";
import { resourceMatches } from "./resource-search";
const account = { name: "AWS account ID", value: "123456789012", group: "Accounts & access" };
describe("resource search", () => {
  it("matches abbreviated names and ignores query case and surrounding space", () => {
    expect(resourceMatches(account, "  AWSID ")).toBe(true);
  });
  it("matches identifiers and groups", () => {
    expect(resourceMatches(account, "7890")).toBe(true);
    expect(resourceMatches(account, "access")).toBe(true);
  });
  it("keeps an empty query and rejects missing matches", () => {
    expect(resourceMatches(account, " ")).toBe(true);
    expect(resourceMatches(account, "xyz")).toBe(false);
  });
});
