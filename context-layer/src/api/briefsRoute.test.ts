import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BriefSchema } from "@atlas/schema";
import { handleHttpRequest } from "./httpRoute";
import { setDevDiscoveryEnv } from "../devMocks";

/**
 * D9 + D11 — the brief endpoints (Step 4, mid-level §3) are governed + scoped on
 * the one router: `GET /api/briefs/{moment}` filters to `ctx.scope` and returns
 * one `Brief` value, `/briefs/{moment}.md` renders the same value as Markdown
 * (a stable address ≠ a stored file), and `debug` is a documented
 * not-yet-available honest response (Step 7, M7) — never a fabricated block.
 * Driven against the MSW discovery fixtures (public-safe `aws/textract` in
 * `awsf`).
 *
 * Red in Batch 0: `handleBriefRequest` / `renderBriefMarkdown` throw
 * `unimplemented`. Green at Batch 5.
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  process.env = savedEnv;
});

describe("brief endpoints (D9)", () => {
  it("adopt: governed + scoped to ctx.scope, one Brief value", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt",
      query: { service: "aws/textract", landingZones: "awsf" },
    });
    expect(response.status).toBe(200);
    const brief = BriefSchema.parse(JSON.parse(response.body));
    expect(brief.moment).toBe("adopt");
    // Scope filters, never addresses: the situation carries the by-value LZ set.
    expect(brief.situation.landingZoneIds).toEqual(["awsf"]);
    expect(brief.blocks.length).toBeGreaterThan(0);
  });

  it("adopt.md: the stable-address Markdown render (≠ a stored file)", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt.md",
      query: { service: "aws/textract", landingZones: "awsf" },
    });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/markdown");
    expect(response.body.length).toBeGreaterThan(0);
  });

  it("scope is real: a different LZ set flows into the situation", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/adopt",
      query: { service: "aws/textract", landingZones: "awsf,azuref" },
    });
    expect(response.status).toBe(200);
    const brief = BriefSchema.parse(JSON.parse(response.body));
    expect(brief.situation.landingZoneIds).toEqual(["awsf", "azuref"]);
  });
});

describe("debug is an honest not-yet-available response (D11)", () => {
  it("returns moment=debug with no fabricated block (deferred to Step 7)", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/briefs/debug",
      query: { landingZones: "awsf" },
    });
    // Honest, not an error: a valid Brief the caller can read.
    expect(response.status).toBe(200);
    const brief = BriefSchema.parse(JSON.parse(response.body));
    expect(brief.moment).toBe("debug");
    // Never fabricated: no block carries resolved debug content (the debug
    // template + operational floor land in Step 7, M7).
    for (const block of brief.blocks) {
      expect(block.evidence).toHaveLength(0);
    }
  });
});
