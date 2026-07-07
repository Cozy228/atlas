/**
 * E7 — the APP selector badges. The VERIFIED badge reads `membershipSource` (axis 2); the
 * PROVENANCE badge reads `origin` (axis 3). The two are never conflated (R4): an
 * Entra-verified APP can still be `origin: "self-declared"`.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppMembershipBadge, AppProvenanceBadge } from "./app-badges";

describe("AppMembershipBadge (E7, verified from membershipSource)", () => {
  it("entra ⇒ verified", () => {
    const html = renderToStaticMarkup(<AppMembershipBadge membershipSource="entra" />);
    expect(html).toContain("verified");
    expect(html).toContain('data-membership="entra"');
    expect(html).not.toContain("self-asserted");
  });

  it("none ⇒ self-asserted", () => {
    const html = renderToStaticMarkup(<AppMembershipBadge membershipSource="none" />);
    expect(html).toContain("self-asserted");
    expect(html).toContain('data-membership="none"');
    expect(html).not.toContain(">verified<");
  });
});

describe("AppProvenanceBadge (E7, provenance from origin)", () => {
  it("registry ⇒ registry", () => {
    const html = renderToStaticMarkup(<AppProvenanceBadge origin="registry" />);
    expect(html).toContain("registry");
    expect(html).toContain('data-origin="registry"');
  });

  it("self-declared ⇒ self-declared", () => {
    const html = renderToStaticMarkup(<AppProvenanceBadge origin="self-declared" />);
    expect(html).toContain("self-declared");
    expect(html).toContain('data-origin="self-declared"');
  });
});

describe("axis separation (R4)", () => {
  it("an Entra-verified APP that is still origin self-declared shows verified + self-declared", () => {
    const membership = renderToStaticMarkup(<AppMembershipBadge membershipSource="entra" />);
    const provenance = renderToStaticMarkup(<AppProvenanceBadge origin="self-declared" />);
    expect(membership).toContain("verified");
    expect(provenance).toContain("self-declared");
  });
});
