/**
 * ServiceIdentityNormalizer (plan 017 decision #3, B1/B8/B9) — turns the
 * availability spine tuple `(provider, id, name)` into a canonical
 * `ServiceIdentity`: a `{provider}/{id}` key (== the service-kind slug, ADR-0015)
 * plus the two alias tiers the discovery pipeline keys on.
 *
 *   recallAliases    — search-only. Handed to CQL `title ~` for WIDE recall. The
 *                      bare machine slug (id-as-words) is recall-eligible here.
 *   admissionAliases — gate-only. Stable human product names + explicit
 *                      abbreviations ONLY. The bare machine slug is NEVER
 *                      admission-eligible (B8): a title matching only the slug
 *                      recalls but is not admitted (B9 token-sequence gate).
 *
 * The normalizer consumes the spine tuple ALONE — `data/resources.yaml` is an
 * optional overlay that ADDS aliases to either tier downstream, never a
 * precondition for forming an identity. All aliases are emitted case-normalized
 * (lowercased, separators collapsed to single spaces) so the discovery client
 * compares against an identically normalized title without re-normalizing here.
 */
import type { ServiceIdentity } from "@atlas/schema";

/** Vendor prefixes stripped from a display name to recover the bare product
 *  name (B8). Extensible — the spine grows as providers enter the inventory. */
const VENDOR_PREFIXES = new Set(["amazon", "aws", "azure", "gcp", "google", "microsoft"]);

export type ServiceIdentityInput = {
  provider: string;
  id: string;
  name: string;
};

export function normalizeServiceIdentity(input: ServiceIdentityInput): ServiceIdentity {
  const provider = input.provider.trim();
  const id = input.id.trim();
  const key = `${provider}/${id}`;

  // The machine slug expressed as words — e.g. "api-gateway" -> "api gateway".
  // Recall-eligible only; it never enters the admission tier.
  const idWords = normalize(id);

  const { base, parentheticals } = splitParentheticals(input.name);
  const baseName = normalize(base);
  const strippedName = stripVendorPrefix(baseName);
  // Parenthetical groups are explicit human abbreviations — "Elastic File System
  // (EFS)" -> "efs" — and ARE admission-eligible (they come from the name, not
  // the machine slug).
  const abbreviations = parentheticals.map(normalize).filter((value) => value.length > 0);

  const admissionAliases = uniq(
    [baseName, strippedName, ...abbreviations].filter((value) => value.length > 0),
  );
  // recall = admission ∪ id-as-words. The slug widens recall but never admission.
  const recallAliases = uniq([...admissionAliases, idWords].filter((value) => value.length > 0));

  return {
    provider,
    id,
    name: input.name.trim(),
    key,
    recallAliases,
    admissionAliases,
  };
}

/**
 * Merge governed-overlay aliases (`resources.yaml` name + aliases) into an
 * identity (B8). Deliberately-curated overlay aliases are trusted, so they ADD
 * to BOTH tiers (recall AND admission) — never replace the derived aliases.
 */
export function applyOverlayAliases(
  identity: ServiceIdentity,
  rawAliases: string[],
): ServiceIdentity {
  const normalized = rawAliases.map(normalize).filter((value) => value.length > 0);
  if (normalized.length === 0) {
    return identity;
  }
  return {
    ...identity,
    recallAliases: uniq([...identity.recallAliases, ...normalized]),
    admissionAliases: uniq([...identity.admissionAliases, ...normalized]),
  };
}

/** Lowercase, collapse every non-alphanumeric run to a single space, trim. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Split "Elastic File System (EFS)" into base "Elastic File System" and the
 *  parenthetical groups ["EFS"]. Nested/empty parens are ignored. */
function splitParentheticals(name: string): { base: string; parentheticals: string[] } {
  const parentheticals: string[] = [];
  const base = name.replace(/\(([^)]*)\)/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed.length > 0) {
      parentheticals.push(trimmed);
    }
    return " ";
  });
  return { base, parentheticals };
}

/** Drop one or more leading vendor tokens from a normalized name. Returns "" if
 *  nothing is left (caller filters empties out). */
function stripVendorPrefix(normalized: string): string {
  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  let start = 0;
  while (start < tokens.length && VENDOR_PREFIXES.has(tokens[start])) {
    start += 1;
  }
  return tokens.slice(start).join(" ");
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}
