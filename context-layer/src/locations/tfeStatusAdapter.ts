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
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 3.
 */
import type { StatusAdapter } from "./statusAdapter";

/** The env var holding the narrow-scoped read-only TFE status token. */
export const TFE_STATUS_TOKEN_ENV = "TFE_STATUS_TOKEN";
/** The system id the TFE adapter answers for. */
export const TFE_ADAPTER_SYSTEM = "tfe";

export function createTfeStatusAdapter(_env: Record<string, string | undefined>): StatusAdapter {
  throw new Error("unimplemented (Step 7 Batch 3)");
}
