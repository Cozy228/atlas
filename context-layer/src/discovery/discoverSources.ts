/**
 * Service source discovery (plan 018 G5). Registry/resources are the OUTPUT of
 * discovery, not authored seed: for every service on the availability spine, we
 * probe its Terraform module at the registry and record what we find. Most
 * services have no module (the registry 404s) → `module: null`, which the
 * derivation engine turns into an honest gap.
 *
 * This is the descriptive half (which module exists / its TOC). The normative
 * half (which heading backs which section) is the kernel's `SECTION_RULES`,
 * applied in `deriveResources`. The only fetch target is the source system
 * (the Terraform registry, prod real / dev MSW), reached through `ctx.fetch`.
 */
import type { ServiceIdentity } from "@atlas/schema";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { discoverTerraformModule } from "../sourceContent/terraformModuleContentProvider";

/** A discovered Terraform module README for one service (descriptive facts only). */
export type DiscoveredModule = {
  /** Synthetic source id derived from the service id — the binding `source_id`. */
  sourceId: string;
  /** Host-less registry address (`<namespace>/<name>/<provider>`) — the source location. */
  address: string;
  /** The README's full ordered heading list (raw TOC). */
  headings: string[];
  /** The module's published version, if the registry reported one. */
  version?: string;
};

/** One service's discovery result: its identity + whichever sources were found. */
export type DiscoveredService = {
  identity: ServiceIdentity;
  module: DiscoveredModule | null;
};

export type DiscoverServiceSourcesDeps = {
  /** The service spine — discovery iterates whatever this returns (N is data). */
  availabilityProvider: AvailabilityProvider;
  /** Late-bound fetch context (dev MSW / prod real / unit fake). */
  ctx: ResolutionContext;
  /** Terraform registry deployment config (host + token), never a source location. */
  terraform: { baseUrl: string; token: string };
};

/**
 * Probe every spine service for a Terraform module. The module address follows
 * the `example/<id>/<provider>` convention; a service with no published module
 * yields `module: null`. Probes run concurrently — one registry fetch per
 * service, deduped upstream by the spine's canonical key.
 */
export async function discoverServiceSources(
  deps: DiscoverServiceSourcesDeps,
): Promise<DiscoveredService[]> {
  const { availabilityProvider, ctx, terraform } = deps;
  const config = { baseUrl: terraform.baseUrl, token: terraform.token };

  const identities = await availabilityProvider.listServices();
  return Promise.all(
    identities.map(async (identity) => {
      const address = `example/${identity.id}/${identity.provider}`;
      const found = await discoverTerraformModule(ctx, config, address);
      const module: DiscoveredModule | null = found
        ? {
            sourceId: `${identity.id}-module-readme`,
            address,
            headings: found.headings,
            version: found.version,
          }
        : null;
      return { identity, module };
    }),
  );
}
