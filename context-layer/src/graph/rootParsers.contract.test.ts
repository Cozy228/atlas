import { beforeAll, describe, expect, it } from "vitest";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_CONFLUENCE_SECURITY_SPACE_KEY,
  DEV_TERRAFORM_BASE_URL,
  DEV_TERRAFORM_MODULE_MAP,
  DEV_TERRAFORM_ORG,
  setDevDiscoveryEnv,
} from "../devMocks";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import { createTestResolutionContext } from "../resolvers/testResolutionContext";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import {
  ParseContractError,
  parseAvailabilityRoot,
  parseSecurityRoot,
  parseTerraformRoot,
} from "./rootParsers";

/**
 * D11 — per-root parse contracts (P16). Each root's parser turns a real fixture
 * page into its descriptive `RootParse`; a shape the parser no longer recognizes
 * throws `ParseContractError` — a RED CI, never a silent empty. A wired root that
 * parses to nothing is drift, not honest-empty (an UNWIRED root is simply never
 * enumerated). The MSW fixture pages are the frozen contract inputs.
 *
 * Drift coverage per root: availability + terraform pin their zero-parse drift
 * throws below. Security is DELIBERATELY lenient (an empty policy space is a
 * legitimate honest-empty — see `parseSecurityRoot`); its drift surfaces as a
 * thrown fetch/parse error from `discoverGuardrails`, so it has no zero-count
 * drift case by design.
 */

describe("root parse contracts (D11)", () => {
  beforeAll(() => {
    setDevDiscoveryEnv(process.env, { referenceSpace: false });
  });

  it("availability root: a wired LZ page parses to its service grid facts", async () => {
    const ctx = await createTestResolutionContext();
    const availabilityProvider = createConfluenceAvailabilityProvider({ fetch: ctx.fetch });
    const parse = await parseAvailabilityRoot("awsf", { ctx, availabilityProvider });

    expect(parse.kind).toBe("availability");
    expect(parse.landingZoneId).toBe("awsf");
    expect(parse.services.length).toBeGreaterThan(0);
    for (const service of parse.services) {
      expect(service.slug).toMatch(/.+\/.+/); // {provider}/{id}
      expect(service.name).toBeTruthy();
    }
  });

  it("availability root: a wired LZ that parses empty is DRIFT (red CI, not honest-empty)", async () => {
    const ctx = await createTestResolutionContext();
    const emptyProvider: AvailabilityProvider = {
      getZones: async () => [],
      listServices: async () => [],
    };
    await expect(
      parseAvailabilityRoot("awsf", { ctx, availabilityProvider: emptyProvider }),
    ).rejects.toBeInstanceOf(ParseContractError);
  });

  it("terraform root: the module probe set parses to service→module version facts", async () => {
    const ctx = await createTestResolutionContext();
    const availabilityProvider = createConfluenceAvailabilityProvider({ fetch: ctx.fetch });
    const parse = await parseTerraformRoot({
      ctx,
      availabilityProvider,
      terraform: {
        baseUrl: DEV_TERRAFORM_BASE_URL,
        token: "dev-mock-token",
        org: DEV_TERRAFORM_ORG,
        moduleMap: DEV_TERRAFORM_MODULE_MAP,
      },
    });

    expect(parse.kind).toBe("terraform");
    expect(parse.modules.length).toBeGreaterThan(0);
    for (const module of parse.modules) {
      expect(module.serviceSlug).toMatch(/.+\/.+/);
      expect(module.address).toBeTruthy();
    }
  });

  it("terraform root: a wired probe set that resolves zero modules is DRIFT (red CI)", async () => {
    const ctx = await createTestResolutionContext();
    const emptyProvider: AvailabilityProvider = {
      getZones: async () => [],
      listServices: async () => [],
    };
    await expect(
      parseTerraformRoot({
        ctx,
        availabilityProvider: emptyProvider,
        terraform: {
          baseUrl: DEV_TERRAFORM_BASE_URL,
          token: "dev-mock-token",
          org: DEV_TERRAFORM_ORG,
          moduleMap: DEV_TERRAFORM_MODULE_MAP,
        },
      }),
    ).rejects.toBeInstanceOf(ParseContractError);
  });

  it("security root: the guardrail space parses to a policy catalog", async () => {
    const ctx = await createTestResolutionContext();
    const parse = await parseSecurityRoot({
      ctx,
      confluence: {
        baseUrl: DEV_CONFLUENCE_BASE_URL,
        token: "dev-mock-token",
        spaceKey: DEV_CONFLUENCE_SECURITY_SPACE_KEY,
      },
    });

    expect(parse.kind).toBe("security");
    expect(parse.guardrails.length).toBeGreaterThan(0);
    for (const guardrail of parse.guardrails) {
      expect(guardrail.slug).toBeTruthy();
      expect(guardrail.name).toBeTruthy();
    }
  });
});
