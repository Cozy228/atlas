/**
 * D5 — the TFE `service-token` adapter walks the M12 model end-to-end (locked
 * decision 4). With a narrow-scoped read-only env token it fetches a workspace's
 * current run state through the TFE allowlisted base and returns the live value
 * (uncited operational status). A MISSING token degrades to a labeled pointer
 * (`fetchValue` → `null`), never an error and never a fabricated value — and it
 * never composes the registered `url` (SSRF closed).
 *
 * Red in Batch 0: `createTfeStatusAdapter` throws `unimplemented`, so every
 * assertion fails behaviorally. Green at Batch 3. Public-safe fictional data.
 */
import { describe, expect, it } from "vitest";
import type { OperationalLocation } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import { DEV_TERRAFORM_BASE_URL } from "../devMocks";
import {
  createTfeStatusAdapter,
  TFE_ADAPTER_SYSTEM,
  TFE_STATUS_TOKEN_ENV,
} from "./tfeStatusAdapter";
import type { StatusAdapterContext } from "./statusAdapter";

const WORKSPACE: OperationalLocation = {
  id: "loc-orion-workspace",
  system: TFE_ADAPTER_SYSTEM,
  kind: "workspace",
  url: "https://flightdeck.example.com/app/orion/workspaces/prod",
  discoveredFrom: "registration",
};

/** A fake fetch recording every requested URL, returning a TFE-shaped run state. */
function recordingFetch(seen: string[]): FetchLike {
  return async (input: string) => {
    seen.push(input);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { attributes: { "current-run-status": "applied" } } }),
    };
  };
}

function contextWith(
  env: Record<string, string | undefined>,
  seen: string[],
): StatusAdapterContext {
  return { fetch: recordingFetch(seen), env };
}

describe("D5: TFE service-token adapter", () => {
  it("declares authMode service-token + the TFE allowlisted base", () => {
    const adapter = createTfeStatusAdapter({ TERRAFORM_BASE_URL: DEV_TERRAFORM_BASE_URL });
    expect(adapter.system).toBe(TFE_ADAPTER_SYSTEM);
    expect(adapter.authMode).toBe("service-token");
    expect(adapter.allowlistedBase).toBe(DEV_TERRAFORM_BASE_URL);
  });

  it("fetches the workspace's current run state through the allowlisted base", async () => {
    const seen: string[] = [];
    const env = {
      TERRAFORM_BASE_URL: DEV_TERRAFORM_BASE_URL,
      [TFE_STATUS_TOKEN_ENV]: "fictional-read-only-token",
    };
    const adapter = createTfeStatusAdapter(env);
    const value = await adapter.fetchValue(WORKSPACE, contextWith(env, seen));

    expect(value).toBe("applied");
    // The fetch went to the allowlisted base, NOT the registered url.
    expect(seen.every((url) => url.startsWith(DEV_TERRAFORM_BASE_URL))).toBe(true);
    expect(seen.some((url) => url.includes("flightdeck.example.com"))).toBe(false);
  });

  it("degrades to a labeled pointer (null) when the read-only token is missing", async () => {
    const seen: string[] = [];
    const env = { TERRAFORM_BASE_URL: DEV_TERRAFORM_BASE_URL };
    const adapter = createTfeStatusAdapter(env);
    const value = await adapter.fetchValue(WORKSPACE, contextWith(env, seen));

    expect(value).toBeNull();
    // No token ⇒ no fetch attempted (never a fabricated value).
    expect(seen).toEqual([]);
  });
});
