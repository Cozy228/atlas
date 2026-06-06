import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";
import { DynamoFeedbackRepository } from "../repositories/dynamoFeedbackRepository.js";
import { InMemoryFeedbackRepository } from "../repositories/feedbackRepository.js";
import {
  buildContextBundle,
  createDefaultContextBundleService,
  createFeedbackRepository,
} from "./contextBundleService.js";

describe("context bundle service", () => {
  it("builds a schema-compatible context bundle for a known topic", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
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

  it("uses query input for deterministic source selection without LLM calls", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      query: "How do I use Textract from a private subnet?",
      disclosure_level: 1,
    });

    expect(bundle.sources.map((source) => source.source.id)).toContain(
      "textract-module-readme",
    );
    expect(bundle.sources.map((source) => source.source.id)).toContain(
      "private-networking-policy",
    );
  });

  it("returns partial bundles with warnings when an anchor is broken", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      topic_id: "private-networking",
      disclosure_level: 1,
    });

    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(bundle.warnings.some((warning) => warning.code === "broken_anchor")).toBe(
      true,
    );
  });

  it("surfaces restricted source warnings without dropping visible context", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      topic_id: "regulated-landing-zone",
      disclosure_level: 1,
    });

    expect(bundle.warnings.some((warning) => warning.code === "restricted_source")).toBe(
      true,
    );
    expect(bundle.sources.length).toBeGreaterThan(0);
  });

  it("surfaces authority conflicts instead of choosing a silent winner", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      topic_id: "s3-guardrails",
      disclosure_level: 1,
    });

    expect(bundle.warnings.some((warning) => warning.code === "authority_conflict")).toBe(
      true,
    );
  });

  it("returns a no registered source warning for missing evidence", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      query: "mainframe",
      disclosure_level: 1,
    });

    expect(bundle.sources).toEqual([]);
    expect(bundle.warnings[0]).toMatchObject({ code: "no_registered_source" });
    expect(bundle.expansion_paths).toEqual([]);
  });

  it("uses disclosure level 0 for metadata and anchor references without excerpts", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      topic_id: "aws-textract",
      disclosure_level: 0,
    });

    expect(bundle.anchor_references.length).toBeGreaterThan(0);
    expect(bundle.sources[0]?.excerpts).toEqual([]);
    expect(bundle.expansion_paths[0]?.disclosure_level).toBe(1);
  });

  it("stops emitting expansion paths at disclosure level 3", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      topic_id: "aws-textract",
      disclosure_level: 3,
    });

    expect(bundle.sources[0]?.excerpts.length).toBeGreaterThan(0);
    expect(bundle.expansion_paths).toEqual([]);
  });

  it("uses disclosure level 2 to include adjacent anchors from the selected source", async () => {
    const service = createDefaultContextBundleService();
    service.registry.anchors.put({
      id: "textract-adjacent-anchor",
      source_id: "textract-module-readme",
      anchor_strategy: "markdown-heading",
      title: "Adjacent Textract guidance",
      selector: { locator: "#private-subnet-usage" },
      citation_label: "textract-module-readme#adjacent",
      status: "valid",
      last_validated_at: "2026-05-06T00:00:00.000Z",
    });

    const levelOne = await buildContextBundle(service, {
      source_id: "textract-module-readme",
      disclosure_level: 1,
    });
    const levelTwo = await buildContextBundle(service, {
      source_id: "textract-module-readme",
      disclosure_level: 2,
    });

    expect(levelOne.sources[0]?.excerpts).toHaveLength(1);
    expect(levelTwo.sources[0]?.excerpts).toHaveLength(2);
  });

  it("uses disclosure level 3 to include related sources from shared topics", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      source_id: "textract-module-readme",
      disclosure_level: 3,
    });

    expect(bundle.sources.map((source) => source.source.id)).toContain(
      "private-networking-policy",
    );
  });

  it("uses in-memory feedback persistence when no DynamoDB table is configured", async () => {
    const repository = createFeedbackRepository({});

    expect(repository).toBeInstanceOf(InMemoryFeedbackRepository);
  });

  it("uses DynamoDB feedback persistence when a table is configured", async () => {
    const repository = createFeedbackRepository({
      ATLAS_FEEDBACK_TABLE: "atlas-feedback",
    });

    expect(repository).toBeInstanceOf(DynamoFeedbackRepository);
  });
});
