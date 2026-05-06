import { z } from "zod";

export const sourceClasses = [
  "terraform-module",
  "confluence-page",
  "policy-document",
] as const;

export const topicTypes = [
  "capability",
  "landing-zone",
  "guardrail-area",
] as const;

export const authorityLevels = [
  "authoritative",
  "reference",
  "example",
  "draft",
  "deprecated",
] as const;

export const visibilityLevels = ["internal", "restricted"] as const;

export const anchorStrategies = [
  "markdown-heading",
  "confluence-section",
  "document-clause",
] as const;

export const topicStatuses = ["active", "deprecated", "planned"] as const;

export const warningCodes = [
  "stale_source",
  "broken_anchor",
  "authority_conflict",
  "restricted_source",
  "source_unavailable",
  "weak_anchoring",
  "no_registered_source",
] as const;

export const apiErrorCodes = [
  "source_not_found",
  "anchor_broken",
  "source_unavailable",
  "access_denied",
  "topic_not_found",
  "invalid_request",
] as const;

export const SourceClassSchema = z.enum(sourceClasses);
export const TopicTypeSchema = z.enum(topicTypes);
export const AuthorityLevelSchema = z.enum(authorityLevels);
export const VisibilitySchema = z.enum(visibilityLevels);
export const AnchorStrategySchema = z.enum(anchorStrategies);
export const TopicStatusSchema = z.enum(topicStatuses);
export const WarningCodeSchema = z.enum(warningCodes);
export const ApiErrorCodeSchema = z.enum(apiErrorCodes);

export const AnchorSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    locator: z.string().min(1),
  })
  .strict();

export const EntryToolSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().min(1),
  })
  .strict();

export const SourceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    source_class: SourceClassSchema,
    location: z.string().min(1),
    steward: z.string().min(1),
    visibility: VisibilitySchema,
    authority_scope: z.array(z.string().min(1)).min(1),
    authority_level: AuthorityLevelSchema,
    anchor_strategy: AnchorStrategySchema,
    available_anchors: z.array(AnchorSchema),
    last_observed_at: z.string().datetime(),
    last_reviewed_at: z.string().datetime(),
    review_frequency: z.string().min(1),
  })
  .strict();

export const TopicSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    topic_type: TopicTypeSchema,
    category: z.string().min(1),
    status: TopicStatusSchema,
    description: z.string().min(1),
    owner_team: z.string().min(1),
    support_channel: z.string().min(1),
    entry_tools: z.array(EntryToolSchema),
  })
  .strict();

export const SourceTopicMappingSchema = z
  .object({
    id: z.string().min(1),
    source_id: z.string().min(1),
    topic_id: z.string().min(1),
  })
  .strict();

export const SourceDiscoveryRequestSchema = z
  .object({
    query: z.string().min(1).optional(),
    topic_id: z.string().min(1).optional(),
    source_class: SourceClassSchema.optional(),
  })
  .strict();

export const SourceDiscoveryResponseSchema = z
  .object({
    sources: z.array(SourceSchema),
  })
  .strict();

export const TopicDiscoveryRequestSchema = z
  .object({
    query: z.string().min(1).optional(),
    topic_type: TopicTypeSchema.optional(),
    category: z.string().min(1).optional(),
  })
  .strict();

export const TopicDiscoveryResponseSchema = z
  .object({
    topics: z.array(TopicSchema),
  })
  .strict();

export const ContextRequestSchema = z
  .object({
    topic_id: z.string().min(1).optional(),
    source_id: z.string().min(1).optional(),
    anchor_id: z.string().min(1).optional(),
    question: z.string().min(1).optional(),
    keyword: z.string().min(1).optional(),
    disclosure_level: z.number().int().min(0).max(3).optional(),
  })
  .strict();

export const ExpansionRequestSchema = z
  .object({
    source_id: z.string().min(1),
    anchor_id: z.string().min(1).optional(),
    disclosure_level: z.number().int().min(0).max(3),
  })
  .strict();

export const CitationSchema = z
  .object({
    source_id: z.string().min(1),
    anchor_id: z.string().min(1).optional(),
    label: z.string().min(1),
    location: z.string().min(1),
  })
  .strict();

export const ExcerptSchema = z
  .object({
    anchor_id: z.string().min(1).optional(),
    text: z.string().min(1),
    citation: CitationSchema,
  })
  .strict();

export const ContextBundleSourceSchema = z
  .object({
    source: SourceSchema,
    anchors: z.array(AnchorSchema),
    selection_rationale: z.string().min(1),
    excerpts: z.array(ExcerptSchema),
  })
  .strict();

export const WarningSchema = z
  .object({
    code: WarningCodeSchema,
    message: z.string().min(1),
    source_id: z.string().min(1).optional(),
    anchor_id: z.string().min(1).optional(),
  })
  .strict();

export const ExpansionPathSchema = z
  .object({
    source_id: z.string().min(1),
    anchor_id: z.string().min(1).optional(),
    disclosure_level: z.number().int().min(0).max(3),
    label: z.string().min(1),
  })
  .strict();

export const ContextBundleResponseSchema = z
  .object({
    bundle_id: z.string().min(1),
    request: ContextRequestSchema,
    sources: z.array(ContextBundleSourceSchema),
    warnings: z.array(WarningSchema),
    expansion_paths: z.array(ExpansionPathSchema),
  })
  .strict();

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type SourceClass = z.infer<typeof SourceClassSchema>;
export type TopicType = z.infer<typeof TopicTypeSchema>;
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type SourceTopicMapping = z.infer<typeof SourceTopicMappingSchema>;
export type SourceDiscoveryRequest = z.infer<typeof SourceDiscoveryRequestSchema>;
export type SourceDiscoveryResponse = z.infer<
  typeof SourceDiscoveryResponseSchema
>;
export type TopicDiscoveryRequest = z.infer<typeof TopicDiscoveryRequestSchema>;
export type TopicDiscoveryResponse = z.infer<typeof TopicDiscoveryResponseSchema>;
export type ContextRequest = z.infer<typeof ContextRequestSchema>;
export type ExpansionRequest = z.infer<typeof ExpansionRequestSchema>;
export type ContextBundleResponse = z.infer<typeof ContextBundleResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
