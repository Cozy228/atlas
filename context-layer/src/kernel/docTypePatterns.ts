/**
 * Rules-only kernel (plan 018): the controlled doc-type classification policy
 * discovery can never produce. Moved verbatim from the Confluence reference
 * discovery adapter (plan 017 B11) so the classification vocabulary is a
 * versioned/reviewed kernel rule, never a discovered instance. Re-imported by
 * `confluenceReferenceDiscovery` so admission behavior is unchanged.
 *
 * A title is classified by the longest matching token-sequence; ties break by
 * `DOC_TYPE_PRIORITY`. Zero hit → `null` (not admitted).
 */
import type { DocType } from "@atlas/schema";

export const DOC_TYPE_PRIORITY: Record<DocType, number> = {
  policy: 3,
  "user-guide": 2,
  design: 1, // widest fallback — lowest tie-break priority (B11)
};

// Controlled, global doc-type patterns (fixed small set, NOT per-space — per-space
// would break O(1), B11). Each is a normalized token-sequence; longest match wins,
// tie-break by DOC_TYPE_PRIORITY. Zero hit → not admitted.
export const DOC_TYPE_PATTERNS: ReadonlyArray<{ docType: DocType; tokens: string[] }> = [
  { docType: "design", tokens: ["design"] },
  { docType: "design", tokens: ["architecture"] },
  { docType: "design", tokens: ["hld"] },
  { docType: "design", tokens: ["lld"] },
  { docType: "design", tokens: ["technical", "design"] },
  { docType: "design", tokens: ["solution", "design"] },
  { docType: "design", tokens: ["design", "document"] },
  { docType: "design", tokens: ["reference", "architecture"] },
  { docType: "user-guide", tokens: ["guide"] },
  { docType: "user-guide", tokens: ["user", "guide"] },
  { docType: "user-guide", tokens: ["how", "to"] },
  { docType: "user-guide", tokens: ["howto"] },
  { docType: "user-guide", tokens: ["runbook"] },
  { docType: "user-guide", tokens: ["onboarding"] },
  { docType: "user-guide", tokens: ["getting", "started"] },
  { docType: "user-guide", tokens: ["usage"] },
  { docType: "user-guide", tokens: ["tutorial"] },
  { docType: "user-guide", tokens: ["quickstart"] },
  { docType: "user-guide", tokens: ["faq"] },
  { docType: "policy", tokens: ["policy"] },
  { docType: "policy", tokens: ["standard"] },
  { docType: "policy", tokens: ["standards"] },
  { docType: "policy", tokens: ["guardrail"] },
  { docType: "policy", tokens: ["compliance"] },
  { docType: "policy", tokens: ["governance"] },
  { docType: "policy", tokens: ["security", "policy"] },
  { docType: "policy", tokens: ["data", "policy"] },
];

export function judgeDocType(title: string): DocType | null {
  const titleTokens = tokenize(title);
  let best: { docType: DocType; tokens: string[] } | null = null;
  for (const pattern of DOC_TYPE_PATTERNS) {
    if (!containsSubsequence(titleTokens, pattern.tokens)) {
      continue;
    }
    if (
      best === null ||
      pattern.tokens.length > best.tokens.length ||
      (pattern.tokens.length === best.tokens.length &&
        DOC_TYPE_PRIORITY[pattern.docType] > DOC_TYPE_PRIORITY[best.docType])
    ) {
      best = pattern;
    }
  }
  return best?.docType ?? null;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/** True when `needle` appears as a CONTIGUOUS run inside `haystack`. */
function containsSubsequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }
  for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}
