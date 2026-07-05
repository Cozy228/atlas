/**
 * The shared source-root configuration (Step 2/4) — the single definition of the
 * three independently-failing roots and their env plumbing, consumed by BOTH the
 * request-time read (`deriveRequestGraph`) and the lifecycle-plane refresh
 * (`refreshGraphSnapshots`). A root descriptor is the pure `(rootId,
 * contractVersion, parse)` triple; each caller stamps `resolvedAt` with its own
 * clock (request `now` vs the injectable refresh clock), so the descriptors carry
 * NO time — that difference stays the caller's, the plumbing is shared.
 */
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { LANDING_ZONES } from "../landingZones";
import type { RootSnapshot } from "./graphTypes";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "./rootIds";
import { parseAvailabilityRoot, parseSecurityRoot, parseTerraformRoot } from "./rootParsers";

/** One source root's identity + its descriptive parse thunk (I/O), without a
 *  clock: the caller stamps `resolvedAt` when it turns this into a snapshot. */
export type RootDescriptor = {
  rootId: string;
  contractVersion: string;
  parse: () => Promise<RootSnapshot["parse"]>;
};

/** Parse the explicit `TERRAFORM_MODULE_MAP` (JSON `identity.key` → module name(s));
 *  malformed / non-object JSON is an honest empty map (no modules bound). */
export function parseModuleMap(raw: string | undefined): Record<string, string[]> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const names = (Array.isArray(value) ? value : [value]).filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      );
      if (names.length > 0) {
        map[key] = names;
      }
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * The three source roots (availability per landing zone / terraform / security),
 * with the same env plumbing both planes use. Each root's parse is isolated — one
 * failing root ages exactly one subgraph (acceptance B).
 */
export function buildRootDescriptors(params: {
  ctx: GovernedResolutionContext;
  availabilityProvider: AvailabilityProvider;
  env: Record<string, string | undefined>;
}): RootDescriptor[] {
  const { ctx, availabilityProvider, env } = params;
  const moduleMap = parseModuleMap(env.TERRAFORM_MODULE_MAP);

  return [
    ...LANDING_ZONES.map((zone) => ({
      rootId: availabilityRootId(zone.id),
      contractVersion: "availability-v1",
      parse: () => parseAvailabilityRoot(zone.id, { ctx, availabilityProvider }),
    })),
    {
      rootId: TERRAFORM_ROOT_ID,
      contractVersion: "terraform-v1",
      parse: () =>
        parseTerraformRoot({
          ctx,
          availabilityProvider,
          terraform: {
            baseUrl: env.TERRAFORM_BASE_URL ?? "",
            token: env.TERRAFORM_TOKEN ?? "",
            org: env.TERRAFORM_ORG ?? "",
            moduleMap,
          },
        }),
    },
    {
      rootId: SECURITY_ROOT_ID,
      contractVersion: "security-v1",
      parse: () =>
        parseSecurityRoot({
          ctx,
          confluence: {
            baseUrl: env.CONFLUENCE_SECURITY_BASE_URL ?? env.CONFLUENCE_BASE_URL ?? "",
            token: env.CONFLUENCE_SECURITY_TOKEN ?? env.CONFLUENCE_TOKEN ?? "",
            email: env.CONFLUENCE_SECURITY_EMAIL ?? env.CONFLUENCE_EMAIL,
            spaceKey: env.CONFLUENCE_SECURITY_SPACE_KEY ?? "",
            rootPageId: env.CONFLUENCE_SECURITY_ROOT_PAGE_ID,
          },
        }),
    },
  ];
}
