import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChangeFeedRoot } from "@atlas/schema";

import { StaleSubgraphBanner } from "./stale-subgraph-banner";

/**
 * T3c — the loud aging banner (D10): it appears only when a root is stale or
 * carries an aging note, names the affected root(s) with an age, and NEVER shows
 * the live roots (the feed keeps rendering their rows). Public-safe fictional data.
 */

const fresh = (rootId: string): ChangeFeedRoot => ({
  rootId,
  resolvedAt: "2026-07-06T08:00:00.000Z",
  stale: false,
});

const stale = (rootId: string): ChangeFeedRoot => ({
  rootId,
  resolvedAt: "2026-07-01T00:00:00.000Z",
  stale: true,
  agingNote: `Source root '${rootId}' is aging: serving last-good from 2026-07-01T00:00:00.000Z.`,
});

describe("StaleSubgraphBanner (T3c)", () => {
  it("renders nothing when every root is live", () => {
    const html = renderToStaticMarkup(
      <StaleSubgraphBanner roots={[fresh("availability:awsf"), fresh("terraform")]} />,
    );
    expect(html).toBe("");
  });

  it("raises a loud alert naming the stale root and its age, but not the live roots", () => {
    const html = renderToStaticMarkup(
      <StaleSubgraphBanner
        roots={[fresh("availability:awsf"), stale("availability:azuref"), fresh("terraform")]}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="stale-subgraph-banner"');
    expect(html).toContain("availability:azuref");
    expect(html).toContain("ago");
    expect(html).toContain("aging");
    // Live roots are NOT named in the banner — their rows render in the feed below.
    expect(html).not.toContain("availability:awsf");
    expect(html).not.toContain(">terraform<");
  });

  it("pluralizes when several roots are aging", () => {
    const html = renderToStaticMarkup(
      <StaleSubgraphBanner roots={[stale("availability:azuref"), stale("security")]} />,
    );
    expect(html).toContain("2 source roots are aging");
  });
});
