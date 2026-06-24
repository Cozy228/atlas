import { describe, expect, it, vi } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { resolveTerraformModuleLive } from "./terraformModuleContentProvider";
import type { FetchLike } from "../resolvers/resolverTypes";

const source: Source = {
  id: "s3-module-readme",
  title: "S3 Terraform Module",
  source_class: "terraform-module",
  // For the live path, location is the host-less registry address.
  location: "example/s3/aws",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage", "storage"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-02T00:00:00.000Z",
  review_frequency: "P90D",
};

const anchor: Anchor = {
  id: "s3-terraform-starter",
  source_id: "s3-module-readme",
  anchor_strategy: "markdown-heading",
  title: "Terraform starter",
  selector: { locator: "#terraform-starter" },
  citation_label: "Terraform starter",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

// Public registry => /v1/modules; a private TFC/TFE host => /api/registry/v1/modules.
const config = { token: "fictional-registry-token", baseUrl: "https://registry.terraform.io" };

const readmeMarkdown = [
  "# terraform-aws-s3",
  "",
  "## Bucket setup",
  "Declare the bucket through the module.",
  "",
  "## Terraform starter",
  "```hcl",
  'module "bucket" {',
  '  source = "example/s3/aws"',
  "}",
  "```",
  "",
  "## Inputs",
  "See variables.tf.",
].join("\n");

function registryFetch(
  body: unknown,
  status = 200,
): { fetch: FetchLike; calls: Array<{ url: string; auth: string }> } {
  const calls: Array<{ url: string; auth: string }> = [];
  const fetch: FetchLike = vi.fn(async (input: string, init) => {
    calls.push({ url: input, auth: init?.headers?.Authorization ?? "" });
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return body;
      },
    };
  });
  return { fetch, calls };
}

describe("resolveTerraformModuleLive", () => {
  it("fetches the registry module README and extracts the anchored section", async () => {
    const { fetch, calls } = registryFetch({
      version: "1.4.0",
      root: { readme: readmeMarkdown },
    });

    const result = await resolveTerraformModuleLive(
      {
        source,
        anchors: [anchor],
        anchorId: "s3-terraform-starter",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toContain('module "bucket"');
    // Section stops at the next heading.
    expect(result.excerpts[0]?.text).not.toContain("See variables.tf.");
    expect(result.excerpts[0]?.citation.location).toBe("example/s3/aws#terraform-starter");
    // The module was addressed through the public registry's module API with the token.
    expect(calls[0]?.url).toBe("https://registry.terraform.io/v1/modules/example/s3/aws");
    expect(calls[0]?.auth).toBe("Bearer fictional-registry-token");
  });

  it("targets the /api/registry/v1 path for a private TFC/TFE host", async () => {
    const { fetch, calls } = registryFetch({ version: "1.4.0", root: { readme: readmeMarkdown } });

    await resolveTerraformModuleLive(
      {
        source,
        anchors: [anchor],
        anchorId: "s3-terraform-starter",
        ctx: { token: config.token, fetch },
      },
      { token: config.token, baseUrl: "https://tfe.example.internal" },
    );

    expect(calls[0]?.url).toBe(
      "https://tfe.example.internal/api/registry/v1/modules/example/s3/aws",
    );
  });

  it("maps 401/403 to a restricted_source warning, not content", async () => {
    const { fetch } = registryFetch({}, 403);

    const result = await resolveTerraformModuleLive(
      {
        source,
        anchors: [anchor],
        anchorId: "s3-terraform-starter",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("restricted_source");
  });

  it("maps 404 to source_unavailable", async () => {
    const { fetch } = registryFetch({}, 404);

    const result = await resolveTerraformModuleLive(
      {
        source,
        anchors: [anchor],
        anchorId: "s3-terraform-starter",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("maps a missing anchor heading to broken_anchor", async () => {
    const { fetch } = registryFetch({
      version: "1.4.0",
      root: { readme: "# terraform-aws-s3\n\n## Inputs\nSee variables.tf." },
    });

    const result = await resolveTerraformModuleLive(
      {
        source,
        anchors: [anchor],
        anchorId: "s3-terraform-starter",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
