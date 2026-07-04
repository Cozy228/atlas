/**
 * D4 — by-reference scope resolves through the REAL store (Step 3, locked
 * decision 6). `selfDeclaredAppsAdapter` implements Step 1's `AppDirectoryPort`
 * over the shared apps repository, and becomes `createResolutionContext`'s
 * default `appDirectory` (Batch 2). Registering an APP and then resolving by
 * reference seats that record's landing-zone set; an unknown appId stays
 * honest-empty with `scope_unresolved` (the Step-1 contract, now backed by a
 * live store instead of the null adapter).
 *
 * The write path (the registration route) and the read path (the adapter) must
 * share ONE `sharedAppsRepository(env)` instance, so a registration is
 * immediately visible to by-reference resolution — that shared-instance wiring
 * is exactly what this test pins. Discovery points at the MSW fixtures so the
 * route's target-existence check accepts `aws/textract`. All data is fictional.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setDevDiscoveryEnv } from "../devMocks";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { handleAppRegistrationRequest } from "../api/appsRoutes";
import { createSelfDeclaredAppsAdapter } from "./selfDeclaredAppsAdapter";
import { sharedAppsRepository } from "./appsRepositoryFactory";

// MSW lifecycle is owned by the global `devMocks/setup.ts`; this file only
// points discovery at the fixtures (mirrors `feedbackRoute.test.ts`).
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

function warningCodesOf(ctx: { warnings: ReadonlyArray<{ code: string }> }): string[] {
  return ctx.warnings.map((warning) => String(warning.code));
}

async function registerApp(landingZoneIds: string[]): Promise<string> {
  const created = await handleAppRegistrationRequest({
    name: "Orion Checkout",
    landingZoneIds,
    serviceSlugs: ["aws/textract"],
  });
  return (created.body as { app: { id: string } }).app.id;
}

describe("D4: selfDeclaredAppsAdapter — by-reference over the real store", () => {
  it("seats the registered record's zone set via an explicit adapter over the shared repo", async () => {
    const appId = await registerApp(["awsf", "azure"]);

    const adapter = createSelfDeclaredAppsAdapter(sharedAppsRepository(process.env));
    const ctx = await createResolutionContext({
      scope: { kind: "by-reference", appId },
      appDirectory: adapter,
    });

    expect(ctx.scope?.landingZoneIds).toEqual(["awsf", "azure"]);
    expect(ctx.scope?.appId).toBe(appId);
    expect(ctx.scope?.origin).toBe("by-reference");
    expect(ctx.warnings).toEqual([]);
  });

  it("is the factory DEFAULT: by-reference resolves with no adapter supplied", async () => {
    const appId = await registerApp(["awsf"]);

    // No `appDirectory` → the Batch-2 default (self-declared adapter over the
    // shared repo) must resolve the just-registered record.
    const ctx = await createResolutionContext({ scope: { kind: "by-reference", appId } });

    expect(ctx.scope?.landingZoneIds).toEqual(["awsf"]);
    expect(ctx.scope?.appId).toBe(appId);
  });

  it("keeps unknown appIds honest-empty with scope_unresolved", async () => {
    const ctx = await createResolutionContext({
      scope: { kind: "by-reference", appId: "app-never-registered" },
      appDirectory: createSelfDeclaredAppsAdapter(sharedAppsRepository(process.env)),
    });

    expect(ctx.scope?.landingZoneIds ?? undefined).toBeUndefined();
    expect(warningCodesOf(ctx)).toContain("scope_unresolved");
  });

  it("the adapter reads the SAME instance the write path wrote (lookup returns the set)", async () => {
    const appId = await registerApp(["azure"]);
    const adapter = createSelfDeclaredAppsAdapter(sharedAppsRepository(process.env));
    expect(await adapter.lookup(appId)).toEqual({ landingZoneIds: ["azure"] });
    expect(await adapter.lookup("app-never-registered")).toBeNull();
  });
});
