import { createHash } from "node:crypto";

/**
 * Stable content hash (Step 2). Used for BOTH the graph `version` (I1: identical
 * snapshots ⇒ identical version) and the `ChangeEvent` idempotency id (M1:
 * re-deriving the same transition is a no-op). Deterministic: object keys are
 * sorted recursively before serialization, so key order never perturbs the hash.
 */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}
