/**
 * Rules-only kernel (plan 018 "2 留"): classification + projection policy that
 * discovery can never produce — versioned/reviewed TS constants, never `data/`.
 * Holds ZERO Source/Resource instances. Re-exports the kernel rules; the
 * normalizer / reference-discovery adapter re-import the moved rules so their
 * behavior is identical.
 */
export { VENDOR_PREFIXES } from "./vendorPrefixes";
export { judgeDocType, DOC_TYPE_PATTERNS, DOC_TYPE_PRIORITY } from "./docTypePatterns";
export { SECTION_RULES, type SectionRule } from "./sectionRules";
