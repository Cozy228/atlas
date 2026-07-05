/**
 * Per-root parsers (Step 2, P16) — one parse per INDEPENDENTLY-FAILING root, so
 * a single root's failure ages exactly one subgraph (acceptance B). Each parser
 * fetches its root through `ctx` (dev MSW / prod real / unit fake) and shapes the
 * result into the root's descriptive `RootParse` (graph-facing facts only — no
 * source bodies, P18). These wrap the hardest-earned code: the availability page,
 * TFE, and Confluence parsing already inside the providers/discovery.
 *
 * Parse contract (P16): a page shape the parser no longer recognizes throws a
 * {@link ParseContractError} — a red CI, never a silent empty. A drift here is
 * expected churn (Track-B negotiation evidence), not an emergency.
 */
import type { AvailabilityRootParse, SecurityRootParse, TerraformRootParse } from "./graphTypes";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { discoverServiceSources } from "../discovery/discoverSources";
import { discoverGuardrails } from "../discovery/discoverGuardrails";
import { availabilityRootId, TERRAFORM_ROOT_ID } from "./rootIds";

/** A source root's live page shape drifted past what its parser recognizes
 *  (P16). Thrown by a parser, surfaced as a red contract test / failed refresh. */
export class ParseContractError extends Error {
  constructor(
    readonly rootId: string,
    message: string,
  ) {
    super(`parse contract drift on root '${rootId}': ${message}`);
    this.name = "ParseContractError";
  }
}

export type AvailabilityRootDeps = {
  ctx: ResolutionContext;
  availabilityProvider: AvailabilityProvider;
};

export async function parseAvailabilityRoot(
  landingZoneId: string,
  deps: AvailabilityRootDeps,
): Promise<AvailabilityRootParse> {
  const rootId = availabilityRootId(landingZoneId);
  const zones = await deps.availabilityProvider.getZones();
  const zone = zones.find((z) => z.id === landingZoneId);

  // An UNWIRED zone (registered target, no availability source) is honest-empty,
  // never drift (ADR-0006). A WIRED zone whose page yields nothing IS drift (P16):
  // the parser expected a grid and got none.
  if (!zone) {
    throw new ParseContractError(rootId, "no availability grid parsed for a wired landing zone");
  }
  if (zone.dataStatus === "not-available") {
    return { kind: "availability", landingZoneId, landingZoneName: zone.name, services: [] };
  }
  if (zone.services.length === 0) {
    throw new ParseContractError(rootId, "a wired availability page parsed to zero services");
  }

  return {
    kind: "availability",
    landingZoneId,
    landingZoneName: zone.name,
    services: zone.services.map((record) => ({
      // The service slug is `{cloud}/{machine-id}` — the LZ's cloud, never its id
      // (ADR-0017), so a slug is stable across zones sharing a cloud.
      slug: `${zone.cloud}/${record.id}`,
      name: record.name,
      domain: record.domain,
    })),
  };
}

export type TerraformRootDeps = {
  ctx: ResolutionContext;
  availabilityProvider: AvailabilityProvider;
  terraform: { baseUrl: string; token: string; org: string; moduleMap: Record<string, string[]> };
};

export async function parseTerraformRoot(deps: TerraformRootDeps): Promise<TerraformRootParse> {
  const discovered = await discoverServiceSources({
    availabilityProvider: deps.availabilityProvider,
    ctx: deps.ctx,
    terraform: deps.terraform,
  });

  const modules = discovered.flatMap((service) =>
    service.modules.map((module) => ({
      serviceSlug: service.identity.key,
      address: module.address,
      name: module.name,
      ...(module.version ? { version: module.version } : {}),
    })),
  );

  // Drift (P16): services ARE mapped to modules but none resolved — the probe set
  // is wired yet parsed nothing. An empty map is honest-empty (no modules bound).
  const mapped = Object.keys(deps.terraform.moduleMap).length;
  if (mapped > 0 && modules.length === 0) {
    throw new ParseContractError(
      TERRAFORM_ROOT_ID,
      `${mapped} service(s) are mapped to modules but none resolved`,
    );
  }

  return { kind: "terraform", modules };
}

export type SecurityRootDeps = {
  ctx: ResolutionContext;
  confluence: {
    baseUrl: string;
    token: string;
    email?: string;
    spaceKey: string;
    rootPageId?: string;
  };
};

export async function parseSecurityRoot(deps: SecurityRootDeps): Promise<SecurityRootParse> {
  const guardrails = await discoverGuardrails({ ctx: deps.ctx, confluence: deps.confluence });

  // An empty policy space is a legitimate honest-empty (a space may simply hold
  // no policies yet), so security is lenient here — drift surfaces as a thrown
  // fetch/parse error from `discoverGuardrails`, not a zero-count. `governedBy`
  // stays undefined: the list-only crawl yields the catalog, not the service
  // linkage (the closed `governed-by` edge is ready for when an adapter lands it).
  return {
    kind: "security",
    guardrails: guardrails.map((guardrail) => ({ slug: guardrail.slug, name: guardrail.name })),
  };
}
