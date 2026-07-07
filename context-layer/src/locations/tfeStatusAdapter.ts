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
 * The value fetch targets the workspace the registration NAMES: the org + workspace
 * slug are parsed out of the human `location.url` (a TFE workspace link,
 * `…/{org}/workspaces/{name}`) and composed onto `allowlistedBase` via
 * `composeValueUrl` — the base origin is fixed and every parsed segment is hardened
 * to `[A-Za-z0-9_-]`, so the fetch can never leave the TFE allowlisted base (SSRF
 * closed by construction). A `url` that is not a recognizable TFE workspace link
 * degrades to a labeled pointer (`null`), never a fetch at a guessed target.
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
      // No allowlisted base configured ⇒ there is no origin to fetch against;
      // degrade to a labeled pointer with NO fetch, even if a token is present (a
      // token must never ride a base-less/relative request).
      if (!allowlistedBase) {
        return null;
      }

      // Read the narrow-scoped token at fetch time. Missing/empty ⇒ degrade to a
      // labeled pointer (null) with NO fetch attempted — never a fabricated value.
      const token = ctx.env[TFE_STATUS_TOKEN_ENV];
      if (!token) {
        return null;
      }

      // Identify the workspace the registration NAMES. An unrecognizable url ⇒ a
      // labeled pointer (null), never a fetch at a guessed target.
      const ref = parseTfeWorkspaceRef(location.url);
      if (!ref) {
        return null;
      }

      // Compose the by-name TFE endpoint against the allowlisted base (SSRF closed
      // by construction); every segment is hardened, the origin is fixed.
      const url = composeValueUrl(
        allowlistedBase,
        "api",
        "v2",
        "organizations",
        ref.org,
        "workspaces",
        ref.workspace,
      );

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

/**
 * Parse the org + workspace slug from a TFE workspace link. Both the app URL
 * (`…/app/{org}/workspaces/{name}`) and the API-style path
 * (`…/organizations/{org}/workspaces/{name}`) are accepted; anything else ⇒ null
 * (the caller degrades to a labeled pointer). The parsed segments are still
 * hardened by `composeValueUrl` before they reach a URL, so this parse never
 * widens the SSRF surface — it only names the fetch target.
 */
function parseTfeWorkspaceRef(url: string): { org: string; workspace: string } | null {
  const match = url.match(/\/(?:app|organizations)\/([^/]+)\/workspaces\/([^/?#]+)/);
  if (!match) {
    return null;
  }
  return { org: match[1], workspace: match[2] };
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
