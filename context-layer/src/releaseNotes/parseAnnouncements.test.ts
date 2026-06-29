import { describe, expect, it } from "vitest";
import { parseAnnouncements } from "./parseAnnouncements";

// Fictional, public-safe — the rendered (renderStorageHtml) form of a What's New
// page: a Release Notes section followed by an Announcements section. Anchor CTAs
// render as "<label> (<href>)". The Incident entry intentionally has no link.
const SAMPLE = `What's New
Release Notes
Release Scope:
Non-Compute:
1. SCP: Enable Object Storage lifecycle tiering [PLAT-201]
For this release change CHG0010001
posted in the Cloud Platform community on 9th June, 2026.
Announcements
New — Object Storage lifecycle tiering is generally available
Buckets can now tier cold objects to archive storage on a per-prefix schedule.
Posted on 11th June, 2026.
View in catalog (/catalog)
Policy — WebAuthn step-up now required for admin scopes
Identity Gateway 4.18 enforces a hardware step-up before any admin-scoped token is issued.
Posted on 7th June, 2026.
Read the policy (/sources)
Incident — Resolved: slow media previews in EU outposts
Edge cache warm-up restored sub-800ms preview latency overnight.
Posted on 5th June, 2026.
`;

describe("parseAnnouncements", () => {
  it("parses each entry under the Announcements header, ignoring release content", () => {
    const announcements = parseAnnouncements(SAMPLE);
    expect(announcements).toHaveLength(3);
    // The Release Notes scope item above the header is never an announcement.
    expect(announcements.some((a) => a.title.includes("SCP"))).toBe(false);
  });

  it("extracts kind, title, summary, posted date, and derived month", () => {
    const [first] = parseAnnouncements(SAMPLE);
    expect(first.kind).toBe("New");
    expect(first.title).toBe("Object Storage lifecycle tiering is generally available");
    expect(first.summary).toBe(
      "Buckets can now tier cold objects to archive storage on a per-prefix schedule.",
    );
    expect(first.postedAt).toBe("2026-06-11");
    expect(first.month).toBe("June 2026");
  });

  it("recovers the call-to-action link, and leaves it unset when absent", () => {
    const announcements = parseAnnouncements(SAMPLE);
    const policy = announcements.find((a) => a.kind === "Policy");
    expect(policy?.link).toEqual({ label: "Read the policy", href: "/sources" });
    // Title with an embedded colon survives the "<Kind> — <Title>" split.
    const incident = announcements.find((a) => a.kind === "Incident");
    expect(incident?.title).toBe("Resolved: slow media previews in EU outposts");
    expect(incident?.link).toBeUndefined();
  });

  it("gives each announcement a self-owned stable id, deterministic across reparses", () => {
    const announcements = parseAnnouncements(SAMPLE);
    for (const a of announcements) {
      expect(a.id).toMatch(/^ann-[0-9a-f]{8}$/);
    }
    expect(new Set(announcements.map((a) => a.id)).size).toBe(3);
    expect(parseAnnouncements(SAMPLE).map((a) => a.id)).toEqual(announcements.map((a) => a.id));
  });

  it("returns nothing when the page has no Announcements section", () => {
    expect(parseAnnouncements("Release Notes\nRelease Scope:\nCompute:\n1. Foo [PLAT-1]")).toEqual(
      [],
    );
  });
});
