import { describe, expect, it, vi } from "vitest";
import type { FetchLike } from "../resolvers/resolverTypes.js";
import { renderStorageHtml, resolveReleaseNotes } from "./resolveReleaseNotes.js";

const STORAGE_HTML = `
  <p>Release Scope:</p>
  <p>Non-Compute:</p>
  <ol>
    <li>SCP: Enable DMS in all OUs [PLAT-101]</li>
    <li>Config: Data Sync hardening guidelines [PLAT-103]</li>
  </ol>
  <p>Compute:</p>
  <ol>
    <li>EC2-Patch Compliance Report Lambda [PLAT-111]</li>
  </ol>
  <p>For this release change CHG0010001 | Change Request</p>
  <p>posted in AWS Federated Platform on 09th May, 2026.</p>
`;

describe("renderStorageHtml", () => {
  it("numbers ordered-list items and keeps headings/paragraphs as lines", () => {
    const text = renderStorageHtml(STORAGE_HTML);
    expect(text).toContain("Non-Compute:");
    expect(text).toContain("1. SCP: Enable DMS in all OUs [PLAT-101]");
    expect(text).toContain("1. EC2-Patch Compliance Report Lambda [PLAT-111]");
  });
});

describe("resolveReleaseNotes", () => {
  const config = { token: "caller-or-service-token", baseUrl: "https://example.atlassian.net" };

  it("fetches via the Confluence channel and parses the page into a release", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      async json() {
        return { body: { storage: { value: STORAGE_HTML } }, version: { number: 3 } };
      },
    }));

    const result = await resolveReleaseNotes({ token: undefined, fetch }, config, "123456");

    expect(fetch).toHaveBeenCalledTimes(1);
    // Same v2 storage endpoint as anchor resolution.
    expect(fetch.mock.calls[0]?.[0]).toContain("/wiki/api/v2/pages/123456?body-format=storage");
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.releases).toHaveLength(1);
      expect(result.releases[0].changeRequest).toBe("CHG0010001");
      expect(result.releases[0].postedAt).toBe("2026-05-09");
      expect(result.releases[0].month).toBe("May 2026");
      expect(result.releases[0].items).toHaveLength(3);
    }
  });

  it("reports not_configured when the page id is unset", async () => {
    const fetch = vi.fn<FetchLike>();
    const result = await resolveReleaseNotes({ token: undefined, fetch }, config);
    expect(result).toMatchObject({ ok: false, code: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces an ACL denial from the channel", async () => {
    const fetch = vi.fn<FetchLike>(async () => ({
      ok: false,
      status: 403,
      async json() {
        return {};
      },
    }));
    const result = await resolveReleaseNotes({ token: undefined, fetch }, config, "123456");
    expect(result).toMatchObject({ ok: false, code: "restricted_source" });
  });
});
