/**
 * Registry manifest gate — validates the real `data/*.yaml` registry control
 * plane against the schema + cross-file invariants, and unit-tests the
 * validators with deliberately broken inputs. This is the import precondition:
 * a malformed manifest fails CI here before it can reach the registry. Also
 * doubles as `pnpm validate:registry`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import {
  validateRegistryManifest,
  validateSourceDocument,
  type RegistryManifestInput,
} from "./index";

const here = dirname(fileURLToPath(import.meta.url));
// src -> atlas-schema -> packages -> repo root -> data
const dataDir = join(here, "..", "..", "..", "data");
const readYaml = (file: string) => parse(readFileSync(join(dataDir, file), "utf8"));

describe("data/* registry manifests", () => {
  const result = validateRegistryManifest({
    sources: readYaml("sources.yaml"),
    topics: readYaml("topics.yaml"),
    anchors: readYaml("anchors.yaml"),
    mappings: readYaml("source-topic-mappings.yaml"),
  });
  const errors = result.issues.filter((i) => i.level === "error");

  it("has no schema or cross-file errors", () => {
    expect(errors).toEqual([]);
  });

  it("parses the expected number of records per kind", () => {
    expect(result.sources).toHaveLength(13);
    expect(result.topics).toHaveLength(9);
    expect(result.anchors).toHaveLength(21);
    expect(result.mappings).toHaveLength(14);
  });
});

const cleanManifest = (): RegistryManifestInput => ({
  sources: [
    {
      id: "s1",
      title: "S1",
      source_class: "policy-document",
      location: "s3://policy/s1.md",
      steward: "platform",
      visibility: "internal",
      authority_scope: ["storage"],
      authority_level: "authoritative",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-05-01T00:00:00.000Z",
      review_frequency: "P90D",
    },
  ],
  topics: [
    {
      id: "t1",
      name: "T1",
      topic_type: "service",
      category: "platform",
      status: "active",
      description: "A topic.",
      owner_team: "platform",
      support_channel: "#platform",
      entry_tools: [],
    },
  ],
  anchors: [
    {
      id: "a1",
      source_id: "s1",
      anchor_strategy: "document-clause",
      title: "A1",
      selector: { locator: "clause-1" },
      citation_label: "A1",
      status: "valid",
      last_validated_at: "2026-05-05T00:00:00.000Z",
    },
  ],
  mappings: [{ id: "m1", source_id: "s1", topic_id: "t1" }],
});

describe("validateRegistryManifest", () => {
  it("accepts a clean manifest with no errors", () => {
    const { issues, sources, topics, anchors, mappings } =
      validateRegistryManifest(cleanManifest());
    expect(issues).toEqual([]);
    expect([sources.length, topics.length, anchors.length, mappings.length]).toEqual([1, 1, 1, 1]);
  });

  it("flags a duplicate id with an actionable message", () => {
    const input = cleanManifest();
    (input.sources as unknown[]).push((input.sources as unknown[])[0]);
    const { issues, sources } = validateRegistryManifest(input);
    expect(sources).toHaveLength(1); // duplicate dropped
    expect(
      issues.some((i) => i.level === "error" && i.message.includes('duplicate source id "s1"')),
    ).toBe(true);
  });

  it("flags a dangling source-topic mapping reference", () => {
    const input = cleanManifest();
    (input.mappings as Array<{ topic_id: string }>)[0].topic_id = "ghost-topic";
    const { issues } = validateRegistryManifest(input);
    const issue = issues.find((i) => i.message.includes('dangling topic_id "ghost-topic"'));
    expect(issue?.level).toBe("error");
    expect(issue?.path).toContain("m1");
  });

  it("flags a dangling anchor source reference", () => {
    const input = cleanManifest();
    (input.anchors as Array<{ source_id: string }>)[0].source_id = "ghost-source";
    const { issues } = validateRegistryManifest(input);
    expect(issues.some((i) => i.message.includes('dangling source_id "ghost-source"'))).toBe(true);
  });

  it("flags a schema violation with the offending record id in the path", () => {
    const input = cleanManifest();
    (input.sources as Array<{ authority_level: string }>)[0].authority_level = "made-up-level";
    const { issues } = validateRegistryManifest(input);
    const issue = issues.find((i) => i.path.includes("sources.yaml:s1"));
    expect(issue?.level).toBe("error");
  });

  it("reports a non-array document kind", () => {
    const input = { ...cleanManifest(), topics: { not: "an array" } };
    const { issues } = validateRegistryManifest(input);
    expect(issues.some((i) => i.message.includes("expected an array of topic records"))).toBe(true);
  });
});

describe("validateSourceDocument", () => {
  const firstSource = () => (cleanManifest().sources as Array<Record<string, unknown>>)[0];

  it("accepts a valid source record", () => {
    const { value, issues } = validateSourceDocument(firstSource(), "s.yaml");
    expect(value?.id).toBe("s1");
    expect(issues).toEqual([]);
  });

  it("rejects a source missing a required field", () => {
    const { id: _omit, ...partial } = firstSource();
    const { value, issues } = validateSourceDocument(partial, "s.yaml");
    expect(value).toBeUndefined();
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});
