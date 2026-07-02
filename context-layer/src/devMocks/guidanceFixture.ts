/**
 * Dev/integration guidance fixture — guidance is MULTI-SOURCE, so this backs
 * both paths the loader merges:
 *
 *  1. The GUIDANCE STORE (`GUIDANCE_URL`) — a JSON array of flat manifests,
 *     served by MSW. Currently EMPTY: the dev demo ships only the onboarding
 *     journey (§2). The store path stays wired (the MSW handler still serves the
 *     array) so prod can point the same env at a real store (a seam for a future
 *     source, e.g. fetched from GitHub) without code changes.
 *  2. The ONBOARDING journey — the REAL onboarding page shape
 *     (`onboarding.sample.html`, Confluence storage HTML), served by page id and
 *     parsed by `confluenceOnboardingProvider` into a stepper journey. The sample
 *     is ALSO the parser's golden-test input, so what dev serves is byte-for-byte
 *     what the live parser reads in prod — render and parse never drift.
 *
 * Everything here is fictional and public-safe.
 */
import { readFileSync } from "node:fs";
import type { ConfluencePageFixture } from "./fixtures";

/* -------------------------------------------------------------------------- *
 * 1. Guidance store (GUIDANCE_URL) — empty in the dev demo (onboarding only)     */

/** Fictional guidance-store base the dev loader is pointed at. */
export const DEV_GUIDANCE_BASE_URL = "https://atlas-guidance-dev.example.com";

/** The guidance-store endpoint that returns the manifests as a JSON array. */
export const DEV_GUIDANCE_URL = `${DEV_GUIDANCE_BASE_URL}/guidance`;

/**
 * Store-served journeys (snake_case, flat schema shape). Empty in the dev demo —
 * the only shipped journey is the onboarding one, authored as a Confluence page
 * (§2). Add manifests here to serve more store-sourced journeys.
 */
export const DEV_GUIDANCE_MANIFESTS: ReadonlyArray<Record<string, unknown>> = [];

/* -------------------------------------------------------------------------- *
 * 2. Onboarding journey — the real Confluence page (storage HTML)               */

/** Page id the dev runtime points `CONFLUENCE_GUIDANCE_ONBOARDING_PAGE_ID` at. */
export const DEV_GUIDANCE_ONBOARDING_PAGE_ID = "700001";

/**
 * The onboarding page's storage HTML — the real page shape (`<h1>` sections of
 * prose, nested lists, typed links, an image). Read from the same file the
 * parser's golden test asserts against. Safe here: devMocks is imported
 * server-side only (`portal/server/devMocks/start.ts` + node tests).
 */
const ONBOARDING_STORAGE_HTML = readFileSync(
  new URL("./onboarding.sample.html", import.meta.url),
  "utf8",
);

/**
 * Confluence v2 page fixture for the onboarding journey, keyed by page id —
 * spread into {@link CONFLUENCE_PAGES} so the v2 page handler serves it and the
 * provider fetches it by id.
 */
export const DEV_GUIDANCE_PAGES: Record<string, ConfluencePageFixture> = {
  [DEV_GUIDANCE_ONBOARDING_PAGE_ID]: {
    id: DEV_GUIDANCE_ONBOARDING_PAGE_ID,
    title: "Meridian Application Onboarding",
    version: { number: 3, createdAt: "2026-06-18T09:00:00.000Z" },
    body: { storage: { value: ONBOARDING_STORAGE_HTML } },
    _links: {
      webui: `/spaces/GUIDE/pages/${DEV_GUIDANCE_ONBOARDING_PAGE_ID}/Meridian+Application+Onboarding`,
    },
  },
};
