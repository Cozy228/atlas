/**
 * D3 — the locations store conforms to the `LocationsRepository` contract (Step 7,
 * locked decision 3). Two layers, `dynamoAppsRepository.test.ts` style:
 *
 *   1. A shared round-trip contract (`put` → `getById` → `listByApp` → `delete`,
 *      unknown id → undefined, scoped-by-app listing) run against BOTH the
 *      in-memory repository and the Dynamo adapter over a stateful fake document
 *      client — same behavior, two backends.
 *   2. Dynamo-specific single-table key assertions: the frozen `pk`/`sk` +
 *      `gsi1pk`/`gsi1sk` shape (`LOC#<id>` / `METADATA` / `APP#<appId>` /
 *      `REGISTERED#<registeredAt>#<id>`) and a per-APP `gsi1` Query for
 *      `listByApp()`.
 *
 * Red in Batch 0: every repository body throws `unimplemented`, so each
 * round-trip / key assertion fails behaviorally. Green when Batch 1 lands the
 * bodies. All data is fictional (public-safe).
 */
import { describe, expect, it } from "vitest";
import type { LocationRecord } from "@atlas/schema";
import { InMemoryLocationsRepository, type LocationsRepository } from "./locationsRepository";
import { DynamoLocationsRepository } from "./dynamoLocationsRepository";

const ORION_WORKSPACE: LocationRecord = {
  id: "loc-orion-workspace",
  appId: "app-orion",
  system: "tfe",
  kind: "workspace",
  url: "https://flightdeck.example.com/app/orion/workspaces/prod",
  discoveredFrom: "registration",
  registeredAt: "2026-07-06T00:00:00.000Z",
};

const ORION_DASHBOARD: LocationRecord = {
  ...ORION_WORKSPACE,
  id: "loc-orion-dashboard",
  kind: "dashboard",
  url: "https://observatory.example.com/d/orion",
  registeredAt: "2026-07-06T01:00:00.000Z",
};

const NEBULA_WORKSPACE: LocationRecord = {
  ...ORION_WORKSPACE,
  id: "loc-nebula-workspace",
  appId: "app-nebula",
  registeredAt: "2026-07-06T02:00:00.000Z",
};

/** A stateful in-memory stand-in for `DynamoDBDocumentClient` — honors the Put /
 *  Get / Query / Delete commands the adapter issues so the contract round-trips. */
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
      const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
      const partition = values[":app"];
      const matches = [...this.items.values()].filter((item) => item.gsi1pk === partition);
      return { Items: matches };
    }
    if (name === "DeleteCommand") {
      const key = command.input.Key as { pk: string; sk: string };
      this.items.delete(`${key.pk}|${key.sk}`);
      return {};
    }
    return {};
  }
}

function makeDynamo(): { repo: LocationsRepository; client: StatefulFakeDocumentClient } {
  const client = new StatefulFakeDocumentClient();
  const repo = new DynamoLocationsRepository({
    tableName: "atlas-locations",
    client: client as never,
  });
  return { repo, client };
}

describe.each([
  ["in-memory", (): LocationsRepository => new InMemoryLocationsRepository()],
  ["dynamo (fake client)", (): LocationsRepository => makeDynamo().repo],
])("D3: LocationsRepository contract — %s", (_label, makeRepo) => {
  it("round-trips put → getById", async () => {
    const repo = makeRepo();
    await repo.put(ORION_WORKSPACE);
    expect(await repo.getById("loc-orion-workspace")).toEqual(ORION_WORKSPACE);
  });

  it("lists only the target APP's locations", async () => {
    const repo = makeRepo();
    await repo.put(ORION_WORKSPACE);
    await repo.put(ORION_DASHBOARD);
    await repo.put(NEBULA_WORKSPACE);
    const ids = (await repo.listByApp("app-orion")).map((loc) => loc.id).sort();
    expect(ids).toEqual(["loc-orion-dashboard", "loc-orion-workspace"]);
  });

  it("deletes a registered location (the DELETE route's only writer)", async () => {
    const repo = makeRepo();
    await repo.put(ORION_WORKSPACE);
    await repo.delete("loc-orion-workspace");
    expect(await repo.getById("loc-orion-workspace")).toBeUndefined();
  });

  it("returns undefined for an unknown id", async () => {
    const repo = makeRepo();
    expect(await repo.getById("loc-missing")).toBeUndefined();
  });
});

describe("D3: Dynamo single-table key contract", () => {
  it("writes the frozen pk/sk + per-APP gsi1 keys", async () => {
    const { repo, client } = makeDynamo();
    await repo.put(ORION_WORKSPACE);

    const put = client.commands.find((command) => command.name === "PutCommand");
    expect(put?.input).toMatchObject({
      TableName: "atlas-locations",
      Item: {
        pk: "LOC#loc-orion-workspace",
        sk: "METADATA",
        gsi1pk: "APP#app-orion",
        gsi1sk: "REGISTERED#2026-07-06T00:00:00.000Z#loc-orion-workspace",
        ...ORION_WORKSPACE,
      },
    });
  });

  it("lists through a per-APP gsi1 Query", async () => {
    const { repo, client } = makeDynamo();
    await repo.put(ORION_WORKSPACE);
    await repo.listByApp("app-orion");

    const query = client.commands.find((command) => command.name === "QueryCommand");
    expect(query?.input).toMatchObject({
      TableName: "atlas-locations",
      IndexName: "gsi1",
      ExpressionAttributeValues: { ":app": "APP#app-orion" },
    });
  });
});
