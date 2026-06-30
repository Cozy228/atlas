import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  server,
  DEV_CONFLUENCE_BASE_URL,
  DEV_RELEASE_NOTES_PAGE_ID,
} from "@atlas/context-layer/devMocks";
import { cachedResolutionContext, resolveReleaseNotes } from "@atlas/context-layer";

// Integration (plan 018 G6): the What's New server fns — `fetchReleaseNotes` and
// `fetchAnnouncements` — both delegate to `resolveReleaseNotes(await
// cachedResolutionContext())`. Drive that exact path against the shared MSW
// "What's New" page fixture. ONE live path, no offline fallback: releases AND
// standalone announcements come off the single live page.
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  process.env.CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.CONFLUENCE_TOKEN = "dev-mock-token";
  process.env.CONFLUENCE_RELEASE_NOTES_PAGE_ID = DEV_RELEASE_NOTES_PAGE_ID;
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

describe("What's New resolution (releases + announcements via MSW)", () => {
  it("resolves the releases that back fetchReleaseNotes from the live page", async () => {
    const result = await resolveReleaseNotes(await cachedResolutionContext());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.releases).toHaveLength(2);
    expect(result.releases.map((release) => release.changeRequest)).toEqual(
      expect.arrayContaining(["CHG0010001", "CHG0010002"]),
    );
    expect(result.releases.every((release) => release.items.length > 0)).toBe(true);
  });

  it("resolves the standalone announcements that back fetchAnnouncements from the same page", async () => {
    const result = await resolveReleaseNotes(await cachedResolutionContext());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.announcements).toHaveLength(3);
    expect(result.announcements.map((announcement) => announcement.kind)).toEqual(
      expect.arrayContaining(["New", "Policy", "Deprecated"]),
    );
    const linked = result.announcements.find((announcement) => announcement.link);
    expect(linked?.link?.href).toMatch(/^\//);
    expect(result.announcements.every((announcement) => announcement.id.startsWith("ann-"))).toBe(
      true,
    );
  });
});
