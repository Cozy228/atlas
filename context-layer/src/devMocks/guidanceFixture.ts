/**
 * Dev/integration guidance fixture — guidance is MULTI-SOURCE, so this backs
 * both paths the loader merges:
 *
 *  1. The GUIDANCE STORE (`GUIDANCE_URL`) — a JSON array of flat manifests,
 *     served by MSW. Currently EMPTY: the dev demo ships only the onboarding
 *     journey (§2). The store path stays wired (the MSW handler still serves the
 *     array) so prod can point the same env at a real store (a seam for a future
 *     source, e.g. fetched from GitHub) without code changes.
 *  2. The ONBOARDING journey AUTHORED as a Confluence page (storage HTML),
 *     fetched by page id and parsed by `confluenceGuidanceProvider`. The page is
 *     emitted from a structured spec by {@link renderGuidancePage} so it stays
 *     readable AND demonstrates the authoring convention the parser reads.
 *
 * Everything here is fictional and public-safe.
 */
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
 * 2. Onboarding journey — authored as a Confluence page (storage HTML)          */

/** Page id the dev runtime points `CONFLUENCE_GUIDANCE_ONBOARDING_PAGE_ID` at. */
export const DEV_GUIDANCE_ONBOARDING_PAGE_ID = "700001";

type StepSpec = {
  title: string;
  description?: string;
  why?: string;
  /** Task rows: a bare line, or a link (→ typed action). `(required)` marks it. */
  items?: Array<{ text: string; href?: string; required?: boolean }>;
  /** A code block → a copy_text task carrying the snippet. */
  code?: { title?: string; text: string };
};

type GuidanceSpec = {
  pageId: string;
  title: string;
  /** Page-properties rows, in render order (keys read case-insensitively). */
  meta: Array<[string, string]>;
  steps: StepSpec[];
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderStep(step: StepSpec): string {
  const parts = [`<h2>${esc(step.title)}</h2>`];
  if (step.description) {
    parts.push(`<p>${esc(step.description)}</p>`);
  }
  if (step.why) {
    parts.push(`<p>Why: ${esc(step.why)}</p>`);
  }
  if (step.items && step.items.length > 0) {
    parts.push("<ul>");
    for (const item of step.items) {
      const label = item.href
        ? `<a href="${esc(item.href)}">${esc(item.text)}</a>`
        : esc(item.text);
      parts.push(`<li>${label}${item.required ? " (required)" : ""}</li>`);
    }
    parts.push("</ul>");
  }
  if (step.code) {
    parts.push('<ac:structured-macro ac:name="code">');
    if (step.code.title) {
      parts.push(`<ac:parameter ac:name="title">${esc(step.code.title)}</ac:parameter>`);
    }
    parts.push(`<ac:plain-text-body><![CDATA[${step.code.text}]]></ac:plain-text-body>`);
    parts.push("</ac:structured-macro>");
  }
  return parts.join("\n");
}

function renderGuidancePage(spec: GuidanceSpec): string {
  return [
    '<ac:structured-macro ac:name="details"><ac:rich-text-body>',
    "<table><tbody>",
    ...spec.meta.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`),
    "</tbody></table>",
    "</ac:rich-text-body></ac:structured-macro>",
    ...spec.steps.map(renderStep),
  ].join("\n");
}

const ONBOARDING_SPEC: GuidanceSpec = {
  pageId: DEV_GUIDANCE_ONBOARDING_PAGE_ID,
  title: "New Application Onboarding",
  meta: [
    ["ID", "new-app-onboarding"],
    ["Scenario", "onboarding"],
    ["Family", "onboard"],
    [
      "Objective",
      "Help an application team onboard a new cloud workload to the standard platform.",
    ],
    ["Owner team", "Cloud Platform"],
    ["Owner support", "cloud-platform-support"],
    ["Status", "published"],
    ["Version", "1.2.0"],
    ["Last reviewed", "2026-04-18"],
    ["Destination title", "Application ready for standard cloud deployment"],
    [
      "Destination description",
      "The app has approved access, a provisioning path, and passes readiness checks.",
    ],
    ["Applies to services", "aws/lambda"],
    ["Sources", "platform-reference-guide"],
  ],
  steps: [
    {
      title: "Choose landing zone",
      description:
        "Select the landing zone that matches this workload's data and compliance needs.",
      why: "The landing zone sets the guardrails, networking, and IAM boundary your app inherits.",
      items: [
        { text: "Review landing zone options", href: "/catalog" },
        { text: "Confirm the selected landing zone", required: true },
      ],
    },
    {
      title: "Request access",
      description: "Open the approved access request path for the selected landing zone.",
      why: "Access must be granted through the approved request flow — Atlas does not submit it for you.",
      items: [
        {
          text: "Open the access request form",
          href: "https://access.example.com/request",
          required: true,
        },
      ],
    },
    {
      title: "Open Terraform Enterprise",
      description: "Use the approved TFE workspace or module to provision infrastructure.",
      why: "Provisioning runs through the approved infrastructure-as-code path, not the console.",
      items: [
        {
          text: "Open the standard TFE workspace",
          href: "https://tfe.example.com/app/example/workspaces/standard",
          required: true,
        },
      ],
      code: {
        title: "Module reference",
        text: 'module "app" {\n  source = "app.terraform.io/example/standard/aws"\n}',
      },
    },
    {
      title: "Connect Harness pipeline",
      description: "Connect the standard deployment path for your service.",
      why: "Deployments are promoted through the approved Harness pipeline templates.",
      items: [
        { text: "Open the Harness setup guide", href: "https://harness.example.com/standard" },
      ],
    },
    {
      title: "Production readiness",
      description: "Confirm required checks before promoting the workload to production.",
      why: "Readiness is verified outside Atlas — this is the checklist, not a sign-off record.",
      items: [
        { text: "Logging and monitoring enabled", required: true },
        { text: "Required resource tags applied", required: true },
        { text: "IAM role pattern reviewed", required: true },
        { text: "Support owner confirmed", required: true },
      ],
    },
  ],
};

/**
 * Confluence v2 page fixtures for the guidance journeys authored in Confluence,
 * keyed by page id — spread into {@link CONFLUENCE_PAGES} so the v2 page handler
 * serves them and the provider fetches them by id.
 */
export const DEV_GUIDANCE_PAGES: Record<string, ConfluencePageFixture> = {
  [ONBOARDING_SPEC.pageId]: {
    id: ONBOARDING_SPEC.pageId,
    title: ONBOARDING_SPEC.title,
    version: { number: 1, createdAt: "2026-04-18T09:00:00.000Z" },
    body: { storage: { value: renderGuidancePage(ONBOARDING_SPEC) } },
    _links: {
      webui: `/spaces/GUIDE/pages/${ONBOARDING_SPEC.pageId}/${ONBOARDING_SPEC.title.replace(/\s+/g, "+")}`,
    },
  },
};
