import { describe, expect, it, vi } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { resolveTerraformModuleLive } from "./terraformModuleContentProvider.js";
import type { FetchLike } from "../resolvers/resolverTypes.js";

const source: Source = {
  id: "s3-module-readme",
  title: "S3 Terraform Module",
  source_class: "terraform-module",
  // For the live path, location is the module's GitHub repo.
  location: "github.com/acme/terraform-aws-s3",
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

const config = { token: "fictional-github-pat", baseUrl: "https://api.github.com" };

const readmeMarkdown = [
  "# terraform-aws-s3",
  "",
  "## Bucket setup",
  "Declare the bucket through the module.",
  "",
  "## Terraform starter",
  "```hcl",
  'module "bucket" {',
  '  source = "app.terraform.io/acme/s3/aws"',
  "}",
  "```",
  "",
  "## Inputs",
  "See variables.tf.",
].join("\n");

function base64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function readmeFetch(
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
  it("fetches the module README and extracts the anchored section", async () => {
    const { fetch, calls } = readmeFetch({
      content: base64(readmeMarkdown),
      encoding: "base64",
      html_url: "https://github.com/acme/terraform-aws-s3/blob/main/README.md",
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
    expect(result.excerpts[0]?.citation.location).toBe(
      "https://github.com/acme/terraform-aws-s3/blob/main/README.md#terraform-starter",
    );
    // The repo was addressed through the GitHub README API with the service token.
    expect(calls[0]?.url).toBe("https://api.github.com/repos/acme/terraform-aws-s3/readme");
    expect(calls[0]?.auth).toBe("Bearer fictional-github-pat");
  });

  it("maps 401/403 to a restricted_source warning, not content", async () => {
    const { fetch } = readmeFetch({}, 403);

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
    const { fetch } = readmeFetch({}, 404);

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
    const { fetch } = readmeFetch({
      content: base64("# terraform-aws-s3\n\n## Inputs\nSee variables.tf."),
      encoding: "base64",
      html_url: "https://github.com/acme/terraform-aws-s3/blob/main/README.md",
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
