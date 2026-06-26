import { describe, expect, it } from "vitest";
import { resourceKinds, sectionIds } from "@atlas/schema";
import { listResourceKinds, resourceKindRegistry } from "@atlas/context-layer";
import { buildAgentOpenApiDocument } from "./openapiDocument";
import { buildAiCatalog } from "./agentDiscovery";

/**
 * Machine-surface consistency (proposal §13.2). The OpenAPI, capability catalog,
 * and resource-kind registry are generated from shared vocabularies; this guards
 * that they can never drift: capability operationIds exist, the `kind`/`sections`
 * enums match the registry/schema, and every registry Section is a schema Section.
 */
type AnyDoc = {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId: string;
        parameters?: Array<{
          name: string;
          schema?: { enum?: string[]; items?: { enum?: string[] } };
        }>;
      }
    >
  >;
};

const agent = JSON.parse(JSON.stringify(buildAgentOpenApiDocument())) as AnyDoc;
const operationIds = new Set(
  Object.values(agent.paths).flatMap((methods) =>
    Object.values(methods).map((operation) => operation.operationId),
  ),
);
const resourceOperation = agent.paths["/api/resources/{kind}/{slug}"].get;
const param = (name: string) => resourceOperation.parameters?.find((p) => p.name === name);

describe("machine-surface consistency", () => {
  it("every ai-catalog capability operationId exists in the agent OpenAPI", () => {
    for (const capability of buildAiCatalog().api.capabilities) {
      expect(operationIds, `capability ${capability.id}`).toContain(capability.operationId);
    }
  });

  it("the OpenAPI kind enum matches the resource-kind registry", () => {
    expect((param("kind")?.schema?.enum ?? []).sort()).toEqual([...resourceKinds].sort());
    expect(listResourceKinds().sort()).toEqual([...resourceKinds].sort());
  });

  it("the OpenAPI sections enum is exactly the schema Section vocabulary", () => {
    expect((param("sections")?.schema?.items?.enum ?? []).sort()).toEqual([...sectionIds].sort());
  });

  it("every registry Section id is a valid schema Section id", () => {
    const known = new Set<string>(sectionIds);
    for (const kind of listResourceKinds()) {
      for (const section of resourceKindRegistry[kind].sections) {
        expect(known, `section ${section.id} (kind ${kind})`).toContain(section.id);
      }
    }
  });
});
