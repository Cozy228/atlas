import { describe, expect, it, vi } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { createInMemorySourceContentProvider } from "./sourceContentProvider";
import { offlineResolutionContext, type FetchLike } from "./resolverTypes";
import { terraformModuleResolver } from "./terraformModuleResolver";

const source: Source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "github.com/example/terraform-aws-textract",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const anchor: Anchor = {
  id: "private-subnet-usage",
  source_id: "textract-module-readme",
  anchor_strategy: "markdown-heading",
  title: "Private subnet usage",
  selector: { locator: "#private-subnet-usage" },
  citation_label: "Private subnet usage",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

const moduleFieldAnchor: Anchor = {
  id: "textract-module-version",
  source_id: "textract-module-readme",
  anchor_strategy: "module-field",
  title: "Module version",
  selector: { field: "version" },
  citation_label: "Module version",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

describe("terraformModuleResolver", () => {
  it("resolves a registered markdown heading anchor", async () => {
    const result = await terraformModuleResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {
          "#private-subnet-usage": "Use the private endpoint configuration.",
        },
      }),
    });

    expect(result.excerpts[0]?.citation).toEqual({
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      label: "Private subnet usage",
      location: "github.com/example/terraform-aws-textract#private-subnet-usage",
    });
    expect(result.warnings).toEqual([]);
  });

  it("returns a broken anchor warning for missing markdown content", async () => {
    const result = await terraformModuleResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {},
      }),
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "broken_anchor",
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
    });
  });

  it("returns source_unavailable when module content cannot be fetched", async () => {
    const result = await terraformModuleResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "source_unavailable",
      source_id: "textract-module-readme",
    });
  });

  it("returns broken_anchor for malformed markdown anchor input", async () => {
    const result = await terraformModuleResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [
        {
          ...anchor,
          selector: { locator: "private-subnet-usage" },
        },
      ],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {
          "private-subnet-usage": "This should not be accepted.",
        },
      }),
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
    env.ATLAS_TERRAFORM_TOKEN = "fictional-github-pat";

    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          content: Buffer.from(
            "## Private subnet usage\nUse the private endpoint configuration.\n",
            "utf8",
          ).toString("base64"),
          encoding: "base64",
          html_url: "https://github.com/example/terraform-aws-textract/blob/main/README.md",
        };
      },
    }));

    const result = await terraformModuleResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      anchors: [anchor],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({}),
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

    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          content: Buffer.from(
            "## Private subnet usage\nUse the private endpoint configuration.\n",
            "utf8",
          ).toString("base64"),
          encoding: "base64",
          html_url: "https://github.com/example/terraform-aws-textract/blob/main/README.md",
        };
      },
    }));

    const result = await terraformModuleResolver.resolve({
      ctx: { token: "caller-bearer-xyz", fetch },
      source,
      anchors: [anchor],
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    if (previousToken !== undefined) {
      env.ATLAS_TERRAFORM_TOKEN = previousToken;
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    const authHeader = fetch.mock.calls[0]?.[1]?.headers?.Authorization;
    expect(authHeader).toContain("caller-bearer-xyz");
    expect(result.excerpts[0]?.text).toContain("Use the private endpoint configuration.");
  });
});
