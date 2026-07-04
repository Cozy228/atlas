/**
 * D7 — the Dynamo apps adapter conforms to the `AppsRepository` contract (Step 3,
 * locked decision 3). Two layers, `dynamoFeedbackRepository.test.ts` style:
 *
 *   1. A shared round-trip contract (`put` → `getById` → `list`, unknown id →
 *      undefined) run against BOTH the in-memory repository and the Dynamo
 *      adapter over a stateful fake document client — same behavior, two
 *      backends.
 *   2. Dynamo-specific single-table key assertions: the frozen `pk`/`sk` +
 *      `gsi1pk`/`gsi1sk` shape (`APP#<id>` / `METADATA` / `APP` /
 *      `DECLARED#<declaredAt>#<id>`) and a `gsi1` Query for `list()`.
 *
 * All data is fictional (public-safe).
 */
import { describe, expect, it } from "vitest";
import type { AppRecord } from "@atlas/schema";
import { InMemoryAppsRepository, type AppsRepository } from "./appsRepository";
import { DynamoAppsRepository } from "./dynamoAppsRepository";

const ORION: AppRecord = {
  id: "app-orion",
  name: "Orion Checkout",
  landingZoneIds: ["awsf", "azure"],
  serviceSlugs: ["aws/textract"],
  origin: "self-declared",
  declaredAt: "2026-07-04T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z",
};

const NEBULA: AppRecord = {
  ...ORION,
  id: "app-nebula",
  name: "Nebula Ledger",
  declaredAt: "2026-07-04T01:00:00.000Z",
  updatedAt: "2026-07-04T01:00:00.000Z",
};

/** A stateful in-memory stand-in for `DynamoDBDocumentClient` — honors the Put /
 *  Get / Query commands the adapter issues so the contract round-trips. */
class StatefulFakeDocumentClient {
  readonly items = new Map<string, Record<string, unknown>>();
  readonly commands: Array<{ name: string; input: Record<string, unknown> }> = [];

  async send(command: {
    constructor: { name: string };
    input: Record<string, unknown>;
  }): Promise<unknown> {
    const name = command.constructor.name;
    this.commands.push({ name, input: command.input });
    if (name === "PutCommand") {
      const item = command.input.Item as Record<string, unknown>;
      this.items.set(`${item.pk}|${item.sk}`, item);
      return {};
    }
    if (name === "GetCommand") {
      const key = command.input.Key as { pk: string; sk: string };
      return { Item: this.items.get(`${key.pk}|${key.sk}`) };
    }
    if (name === "QueryCommand") {
      return { Items: [...this.items.values()] };
    }
    return {};
  }
}

function makeDynamo(): { repo: AppsRepository; client: StatefulFakeDocumentClient } {
  const client = new StatefulFakeDocumentClient();
  const repo = new DynamoAppsRepository({ tableName: "atlas-apps", client: client as never });
  return { repo, client };
}

describe.each([
  ["in-memory", (): AppsRepository => new InMemoryAppsRepository()],
  ["dynamo (fake client)", (): AppsRepository => makeDynamo().repo],
])("D7: AppsRepository contract — %s", (_label, makeRepo) => {
  it("round-trips put → getById", async () => {
    const repo = makeRepo();
    await repo.put(ORION);
    expect(await repo.getById("app-orion")).toEqual(ORION);
  });

  it("lists every stored record", async () => {
    const repo = makeRepo();
    await repo.put(ORION);
    await repo.put(NEBULA);
    const ids = (await repo.list()).map((app) => app.id).sort();
    expect(ids).toEqual(["app-nebula", "app-orion"]);
  });

  it("returns undefined for an unknown id", async () => {
    const repo = makeRepo();
    expect(await repo.getById("app-missing")).toBeUndefined();
  });
});

describe("D7: Dynamo single-table key contract", () => {
  it("writes the frozen pk/sk + gsi1 keys", async () => {
    const { repo, client } = makeDynamo();
    await repo.put(ORION);

    const put = client.commands.find((command) => command.name === "PutCommand");
    expect(put?.input).toMatchObject({
      TableName: "atlas-apps",
      Item: {
        pk: "APP#app-orion",
        sk: "METADATA",
        gsi1pk: "APP",
        gsi1sk: "DECLARED#2026-07-04T00:00:00.000Z#app-orion",
        ...ORION,
      },
    });
  });

  it("lists through a gsi1 Query on the constant APP partition", async () => {
    const { repo, client } = makeDynamo();
    await repo.put(ORION);
    await repo.list();

    const query = client.commands.find((command) => command.name === "QueryCommand");
    expect(query?.input).toMatchObject({
      TableName: "atlas-apps",
      IndexName: "gsi1",
      ExpressionAttributeValues: { ":app": "APP" },
    });
  });
});
