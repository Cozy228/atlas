/**
 * MSW request handlers — intercept outbound source-system fetches and answer
 * from {@link fixtures}. Node mode only (`msw/node`): the fetch target is the
 * server-side source systems the context-layer adapters read, never a browser.
 *
 * Lane H adds one handler group per source system. G0 seeds the Confluence v2
 * page read. Every handler applies {@link devMockLatencyMs} so the dev runtime
 * exercises the deferred-loading UI under realistic latency.
 */
import { http, HttpResponse, delay } from "msw";
import {
  CONFLUENCE_PAGES,
  CQL_REFERENCE_CORPUS,
  DEV_CONFLUENCE_BASE_URL,
  DEV_TERRAFORM_BASE_URL,
  TERRAFORM_MODULES,
} from "./fixtures";

/**
 * Space-only listing recall (plan 018 G5): all pages under a space, used by
 * guardrail discovery's `space = SECPOL AND type = page` crawl. Sourced from the
 * page fixtures themselves (single source of truth) — every page whose webui sits
 * under `/spaces/<spaceKey>/` is returned in the CQL search result shape.
 */
function listSpacePages(spaceKey: string) {
  return Object.values(CONFLUENCE_PAGES)
    .filter((page) => page._links.webui.includes(`/spaces/${spaceKey}/`))
    .map((page) => ({ title: page.title, _links: { webui: page._links.webui } }));
}

/** Configurable injected latency (ms) so dev render shows real loading states. */
export function devMockLatencyMs(): number {
  const raw = readEnv().ATLAS_DEV_MOCK_LATENCY_MS;
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/** Confluence Cloud REST v2 page read — the live content provider's fetch target. */
const confluencePageHandlers = [
  http.get(`${DEV_CONFLUENCE_BASE_URL}/wiki/api/v2/pages/:pageId`, async ({ params }) => {
    await delay(devMockLatencyMs());
    const pageId = String(params.pageId);
    const page = CONFLUENCE_PAGES[pageId];
    if (!page) {
      return HttpResponse.json({ errors: [{ status: 404 }] }, { status: 404 });
    }
    return HttpResponse.json(page);
  }),
];

/**
 * Confluence Cloud CQL search (v1) — the reference-discovery adapter's fetch
 * target. Reproduces Confluence `title ~` fuzzy recall over {@link CQL_REFERENCE_CORPUS}:
 * extract the quoted aliases from the `cql` param and return every candidate whose
 * title contains any alias. The adapter applies its own double-hit admission on top,
 * so noise candidates recalled here are filtered there. Honest 5xx/4xx and truncation
 * states are exercised by per-test `server.use(...)` overrides, not baked in here.
 */
const cqlSearchHandlers = [
  http.get(`${DEV_CONFLUENCE_BASE_URL}/wiki/rest/api/content/search`, async ({ request }) => {
    await delay(devMockLatencyMs());
    const cql = new URL(request.url).searchParams.get("cql") ?? "";
    const aliases = [...cql.matchAll(/title\s*~\s*"([^"]*)"/g)].map((m) =>
      m[1].toLowerCase().trim(),
    );

    // Space-only listing (no `title ~` clause): a `space = <KEY>` crawl returns
    // every page in that space — the guardrail-discovery recall path (G5). The
    // title-recall path (any `title ~`) keeps its exact prior behaviour.
    if (aliases.length === 0) {
      const spaceKey = cql.match(/space\s*=\s*"?([A-Za-z0-9_-]+)"?/)?.[1];
      const results = spaceKey ? listSpacePages(spaceKey) : [];
      return HttpResponse.json({ results, totalSize: results.length, _links: {} });
    }

    const results = CQL_REFERENCE_CORPUS.filter((candidate) => {
      const title = candidate.title.toLowerCase();
      return aliases.some((alias) => alias.length > 0 && title.includes(alias));
    }).map((candidate) => ({ title: candidate.title, _links: { webui: candidate.webui } }));
    return HttpResponse.json({ results, totalSize: results.length, _links: {} });
  }),
];

/**
 * Terraform module registry detail — the live Terraform content provider's fetch
 * target. A non-public base selects the TFE `/api/registry/v1/modules` API path;
 * the returned README + version back both the README-prose anchors (heading-slug
 * scan) and the `module-field` anchors (ADR-0010). 404 when the module is absent.
 */
const terraformModuleHandlers = [
  http.get(
    `${DEV_TERRAFORM_BASE_URL}/api/registry/v1/modules/:namespace/:name/:provider`,
    async ({ params }) => {
      await delay(devMockLatencyMs());
      const address = `${params.namespace}/${params.name}/${params.provider}`;
      const module = TERRAFORM_MODULES[address];
      if (!module) {
        return HttpResponse.json({ errors: [{ status: 404 }] }, { status: 404 });
      }
      return HttpResponse.json(module);
    },
  ),
];

/** Every handler the Node-mode server registers. Order: most specific first. */
export const handlers = [
  ...confluencePageHandlers,
  ...cqlSearchHandlers,
  ...terraformModuleHandlers,
];
