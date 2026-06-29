import { describe, expect, it, vi } from "vitest";
import type { Source } from "@atlas/schema";
import type { FetchLike } from "./resolverTypes";
import { terraformModuleResolver } from "./terraformModuleResolver";

const source: Source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "example/textract/aws",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

/** A live registry module response (root.readme + version), as the v1 module API returns. */
function registryFetch(body: unknown) {
  return vi.fn<FetchLike>(async () => ({
    ok: true,
    status: 200,
    async json() {
      return body;
    },
  }));
}

/** A failed registry fetch (e.g. 404/5xx) — the module cannot be resolved live. */
function failingFetch(status: number) {
  return vi.fn<FetchLike>(async () => ({
    ok: false,
    status,
    async json() {
      return {};
    },
  }));
}

describe("terraformModuleResolver (single live path)", () => {
  it("resolves a registered markdown heading anchor from the live registry", async () => {
    const fetch = registryFetch({
      version: "1.4.0",
      root: { readme: "## Private subnet usage\nUse the private endpoint configuration.\n" },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toContain("Use the private endpoint configuration.");
    expect(result.excerpts[0]?.citation).toEqual({
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      label: "Private subnet usage",
      location: "example/textract/aws#private-subnet-usage",
    });
    expect(result.warnings).toEqual([]);
  });

  it("returns a broken_anchor warning when the heading is absent from the live README", async () => {
    const fetch = registryFetch({
      version: "1.4.0",
      root: { readme: "## A different heading\nUnrelated content.\n" },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "broken_anchor",
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
    });
  });

  it("returns source_unavailable (honest gap) when no registry credential is configured", async () => {
    const env = (
      globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
      }
    ).process.env;
    const previousToken = env.ATLAS_TERRAFORM_TOKEN;
    delete env.ATLAS_TERRAFORM_TOKEN;

    const fetch = registryFetch({ version: "1.4.0", root: { readme: "" } });
    const result = await terraformModuleResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    if (previousToken !== undefined) {
      env.ATLAS_TERRAFORM_TOKEN = previousToken;
    }

    // No token = honest gap: never fetched, never a fake fallback.
    expect(fetch).not.toHaveBeenCalled();
    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "source_unavailable",
      source_id: "textract-module-readme",
    });
  });

  it("returns source_unavailable when the live registry fetch fails", async () => {
    const fetch = failingFetch(404);

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "source_unavailable",
      source_id: "textract-module-readme",
    });
  });

  it("returns broken_anchor when no section heading is supplied to locate", async () => {
    const fetch = registryFetch({
      version: "1.4.0",
      root: { readme: "## Private subnet usage\nUse the private endpoint configuration.\n" },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("takes the live branch when a service token is configured", async () => {
    const env = (
      globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
      }
    ).process.env;
    const previousToken = env.ATLAS_TERRAFORM_TOKEN;
    env.ATLAS_TERRAFORM_TOKEN = "fictional-registry-token";

    const fetch = registryFetch({
      version: "2.1.0",
      root: { readme: "## Private subnet usage\nUse the private endpoint configuration.\n" },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    if (previousToken === undefined) {
      delete env.ATLAS_TERRAFORM_TOKEN;
    } else {
      env.ATLAS_TERRAFORM_TOKEN = previousToken;
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toContain("Use the private endpoint configuration.");
  });

  it("uses the caller's Bearer for the live fetch even without a service token", async () => {
    const env = (
      globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
      }
    ).process.env;
    const previousToken = env.ATLAS_TERRAFORM_TOKEN;
    delete env.ATLAS_TERRAFORM_TOKEN;

    const fetch = registryFetch({
      version: "2.1.0",
      root: { readme: "## Private subnet usage\nUse the private endpoint configuration.\n" },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      heading: "Private subnet usage",
      citationLabel: "Private subnet usage",
    });

    if (previousToken !== undefined) {
      env.ATLAS_TERRAFORM_TOKEN = previousToken;
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    const authHeader = fetch.mock.calls[0]?.[1]?.headers?.Authorization;
    expect(authHeader).toContain("caller-bearer-xyz");
    expect(result.excerpts[0]?.text).toContain("Use the private endpoint configuration.");
  });

  it("resolves a module-field binding (selector.field) live from the registry when a token is configured", async () => {
    const fetch = registryFetch({
      version: "2.1.0",
      root: { readme: "## X\n", inputs: [], outputs: [] },
    });

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      selector: { field: "version" },
      citationLabel: "Module version",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toBe("2.1.0");
    expect(result.excerpts[0]?.citation.location).toBe("example/textract/aws#version");
  });
});
