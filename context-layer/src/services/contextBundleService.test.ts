import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";
import { buildContextBundle, createDefaultContextBundleService } from "./contextBundleService.js";

describe("context bundle service", () => {
  it("builds a schema-compatible context bundle for a known topic", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      topic_id: "aws-textract",
      disclosure_level: 1,
    });

    expect(ContextBundleResponseSchema.parse(bundle)).toEqual(bundle);
    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(bundle.sources[0]?.source.id).toBe("textract-module-readme");
    expect(bundle.sources[0]?.excerpts[0]?.citation.source_id).toBe(
      "textract-module-readme",
    );
    expect(bundle.expansion_paths.length).toBeGreaterThan(0);
  });

  it("uses question input for deterministic source selection without LLM calls", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      question: "How do I use Textract from a private subnet?",
      disclosure_level: 1,
    });

    expect(bundle.sources.map((source) => source.source.id)).toContain(
      "textract-module-readme",
    );
    expect(bundle.sources.map((source) => source.source.id)).toContain(
      "private-networking-policy",
    );
  });

  it("returns partial bundles with warnings when an anchor is broken", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      topic_id: "private-networking",
      disclosure_level: 1,
    });

    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(bundle.warnings.some((warning) => warning.code === "broken_anchor")).toBe(
      true,
    );
  });

  it("surfaces restricted source warnings without dropping visible context", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      topic_id: "regulated-landing-zone",
      disclosure_level: 1,
    });

    expect(bundle.warnings.some((warning) => warning.code === "restricted_source")).toBe(
      true,
    );
    expect(bundle.sources.length).toBeGreaterThan(0);
  });

  it("surfaces authority conflicts instead of choosing a silent winner", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      topic_id: "s3-guardrails",
      disclosure_level: 1,
    });

    expect(bundle.warnings.some((warning) => warning.code === "authority_conflict")).toBe(
      true,
    );
  });

  it("returns a no registered source warning for missing evidence", () => {
    const service = createDefaultContextBundleService();

    const bundle = buildContextBundle(service, {
      keyword: "mainframe",
      disclosure_level: 1,
    });

    expect(bundle.sources).toEqual([]);
    expect(bundle.warnings[0]).toMatchObject({ code: "no_registered_source" });
    expect(bundle.expansion_paths).toEqual([]);
  });
});
