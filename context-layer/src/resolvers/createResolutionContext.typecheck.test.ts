/**
 * D1 — an ungoverned read is unrepresentable (Step 1, I2): a usable
 * `GovernedResolutionContext` cannot be constructed outside the factory.
 * The proof is type-level; this file is expected to typecheck (the
 * `@ts-expect-error` directive itself errors if the forged literal ever
 * starts compiling) and to stay green from Batch 0 onward.
 */
import { describe, expect, it } from "vitest";

import type { FetchLike } from "./resolverTypes";
import { createResolutionContext, type GovernedResolutionContext } from "./createResolutionContext";

const fakeFetch: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({}) });

describe("D1 — governed context construction is factory-only", () => {
  it("D1: a hand-written object literal does not satisfy GovernedResolutionContext; the factory path compiles", async () => {
    // The literal supplies every structural field (`fetch`, `warnings`) so the
    // ONLY missing piece is the module-private brand — which no code outside
    // createResolutionContext.ts can name. If the brand is ever weakened, this
    // directive becomes "unused" and `tsc --noEmit` fails the repo typecheck.
    // @ts-expect-error — the brand is module-private; construction from nothing is forbidden
    const forged: GovernedResolutionContext = { fetch: fakeFetch, warnings: [] };
    void forged;

    // The factory-call path compiles and is typed as the governed type. Its
    // behavior is Batch 1 — a skeleton throw/rejection is tolerated on purpose.
    const viaFactory: Promise<GovernedResolutionContext> = createResolutionContext({
      identity: { bearer: "fictional-caller-token-123" },
    });
    await viaFactory.catch(() => undefined);

    expect(typeof createResolutionContext).toBe("function");
  });
});
