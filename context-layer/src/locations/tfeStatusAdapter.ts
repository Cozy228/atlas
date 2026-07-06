/**
 * The TFE `service-token` adapter (Step 7, locked decision 4) — the first
 * value-capable adapter, walking the full M12 model end-to-end and the
 * conformance exemplar for the next one.
 *
 * `authMode: "service-token"`: a narrow-scoped read-only env token
 * (`TFE_STATUS_TOKEN` class) fetches a workspace's current run state through the
 * TFE `allowlistedBase` (`TERRAFORM_BASE_URL`). The token is read at fetch time
 * and NEVER stored; a MISSING token degrades to a labeled pointer
 * (`reason: no-value-channel`), never an error and never a fabricated value.
 *
 * The value fetch composes `allowlistedBase` + a path derived from the location
 * (its workspace id) via `composeValueUrl` — NEVER the registered `location.url`
 * (SSRF closed by construction).
 */
import type { StatusAdapter, StatusAdapterContext } from "./statusAdapter";
import { composeValueUrl } from "./statusAdapter";
import type { OperationalLocation } from "@atlas/schema";

/** The env var holding the narrow-scoped read-only TFE status token. */
export const TFE_STATUS_TOKEN_ENV = "TFE_STATUS_TOKEN";
/** The system id the TFE adapter answers for. */
export const TFE_ADAPTER_SYSTEM = "tfe";

/**
 * Build the TFE `service-token` adapter. The allowlisted base is captured at
 * construction from `TERRAFORM_BASE_URL` (deployment config, not a secret); the
 * read-only token is NOT captured — it is read from `ctx.env` at fetch time and
 * never stored on the adapter, never logged, never echoed in a thrown value.
 */
export function createTfeStatusAdapter(env: Record<string, string | undefined>): StatusAdapter {
  const allowlistedBase = env.TERRAFORM_BASE_URL ?? "";

  return {
    system: TFE_ADAPTER_SYSTEM,
    authMode: "service-token",
    allowlistedBase,
    async fetchValue(
      location: OperationalLocation,
      ctx: StatusAdapterContext,
    ): Promise<string | null> {
      // Read the narrow-scoped token at fetch time. Missing/empty ⇒ degrade to a
      // labeled pointer (null) with NO fetch attempted — never a fabricated value.
      const token = ctx.env[TFE_STATUS_TOKEN_ENV];
      if (!token) {
        return null;
      }

      // Compose ONLY against the allowlisted base (SSRF closed by construction);
      // the registered `location.url` is never a GET target.
      const url = composeValueUrl(allowlistedBase, location);

      try {
        const response = await ctx.fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.api+json",
          },
        });
        if (!response.ok) {
          return null;
        }
        return extractRunStatus(await response.json());
      } catch {
        // Unreachable host / unparsable body ⇒ labeled pointer, never a throw.
        // Nothing is logged or echoed, so the token cannot leak through an error.
        return null;
      }
    },
  };
}

/** Pull `data.attributes["current-run-status"]` from a TFE workspace payload;
 *  any shape mismatch ⇒ null (a labeled pointer), never a fabricated value. */
function extractRunStatus(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const attributes = (data as { attributes?: unknown }).attributes;
  if (typeof attributes !== "object" || attributes === null) {
    return null;
  }
  const status = (attributes as Record<string, unknown>)["current-run-status"];
  return typeof status === "string" ? status : null;
}
