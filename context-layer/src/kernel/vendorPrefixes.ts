/**
 * Rules-only kernel (plan 018): the normative naming rule discovery can never
 * produce. Vendor prefixes stripped from a service display name to recover the
 * bare product name (plan 017 B8) — e.g. "Amazon Textract" -> "textract".
 *
 * Lives in the kernel (not `data/`) because it is a versioned/reviewed
 * classification rule, never a discovered instance. Extensible: the spine grows
 * as providers enter the inventory. Re-imported by `serviceIdentityNormalizer`
 * so the normalizer's behavior is unchanged.
 */
export const VENDOR_PREFIXES = new Set(["amazon", "aws", "azure", "gcp", "google", "microsoft"]);
