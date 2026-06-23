import { z } from "zod";

export const sourceClasses = [
  "terraform-module",
  "confluence-page",
  "policy-document",
  "availability-matrix",
] as const;

export const topicTypes = ["service", "landing-zone", "guardrail-area"] as const;

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
  // Parametric matrix address (ADR-0009): the selector pins a Service, a region,
  // or both, and the resolver answers at that grain (cell / row / column).
  "availability-cell",
  // Terraform registry metadata field (ADR-0010): the selector pins a module
  // metadata field (version / input / output) alongside README prose anchors.
  "module-field",
] as const;

export const topicStatuses = ["active", "deprecated", "planned"] as const;
export const anchorStatuses = ["valid", "broken", "weak", "unvalidated"] as const;
export const feedbackTargetTypes = ["topic", "source", "anchor"] as const;
export const feedbackTypes = ["missing", "stale", "broken", "unclear"] as const;

export const warningCodes = [
  "stale_source",
  "broken_anchor",
  "authority_conflict",
  "restricted_source",
  "source_unavailable",
  "weak_anchoring",
  "no_registered_source",
  // Honest dead-end for an availability matrix that cannot be fetched/parsed
  // (ADR-0009 §4): no availability data is returned and never a stale matrix.
  "availability_unavailable",
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
export const AnchorStatusSchema = z.enum(anchorStatuses);
export const FeedbackTargetTypeSchema = z.enum(feedbackTargetTypes);
export const FeedbackTypeSchema = z.enum(feedbackTypes);
export const WarningCodeSchema = z.enum(warningCodes);
export const ApiErrorCodeSchema = z.enum(apiErrorCodes);

export const AnchorSchema = z
  .object({
    id: z.string().min(1),
    source_id: z.string().min(1),
    anchor_strategy: AnchorStrategySchema,
    title: z.string().min(1),
    selector: z.record(z.string(), z.unknown()),
    citation_label: z.string().min(1),
    content_fingerprint: z.string().min(1).optional(),
    status: AnchorStatusSchema,
    last_validated_at: z.string().datetime(),
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
    last_observed_at: z.string().datetime(),
    last_reviewed_at: z.string().datetime(),
    review_frequency: z.string().min(1),
    // The source-of-record version Atlas last recorded for this Source. When
    // the live page version exceeds it, runtime resolution emits stale_source
    // (drift). Optional: with no recorded version, drift never fires.
    observed_version: z.number().int().nonnegative().optional(),
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

export const FeedbackSchema = z
  .object({
    id: z.string().min(1),
    target_type: FeedbackTargetTypeSchema,
    target_id: z.string().min(1),
    feedback_type: FeedbackTypeSchema,
    message: z.string().min(1),
    submitted_at: z.string().datetime(),
  })
  .strict();

export const FeedbackSubmissionSchema = FeedbackSchema.omit({
  id: true,
  submitted_at: true,
});

export const FeedbackResponseSchema = z
  .object({
    feedback: FeedbackSchema,
  })
  .strict();

export const TopicResponseSchema = z
  .object({
    topic: TopicSchema,
  })
  .strict();

export const SourceResponseSchema = z
  .object({
    source: SourceSchema,
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
    query: z.string().min(1).optional(),
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

export const AnchorReferenceSchema = z
  .object({
    source_id: z.string().min(1),
    anchor_id: z.string().min(1),
    citation_label: z.string().min(1),
    status: AnchorStatusSchema,
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
    anchor_references: z.array(AnchorReferenceSchema),
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

/* -------------------------------------------------------------------------- *
 * Guidance manifest
 *
 * The authoring/import contract for route-guidance objects (see
 * `docs/product/guidance_design.md`). Guidance -> steps -> tasks, rendered as a
 * vertical stepper. AI may draft a manifest from a process document; an owner
 * reviews it; the validate/import gate checks it against this schema before it
 * enters the registry. snake_case matches the Source/Topic API convention so a
 * `data/guidance/*.yaml` file validates directly.
 *
 * `type` is a renderer preset, not a separate schema (guidance_design §6). MVP
 * ships only `route`; `decision`/`checklist` are modelled here for forward
 * compatibility, not yet in MVP renderer scope.
 * -------------------------------------------------------------------------- */

export const guidanceTypes = ["route", "decision", "checklist"] as const;
export const scenarioFamilies = ["onboard", "decide", "enable", "validate"] as const;
export const stepKinds = ["action", "decision", "checklist", "support", "destination"] as const;
export const guidanceStatuses = ["draft", "published", "needs_review", "deprecated"] as const;
export const guidanceActionTypes = [
  "atlas_page",
  "external_link",
  "source_link",
  "tool_link",
  "support_link",
  "copy_text",
] as const;
/** Intrinsic step markers independent of which step is selected. */
export const stepMarkers = ["blocked", "needs_support"] as const;

export const GuidanceTypeSchema = z.enum(guidanceTypes);
export const ScenarioFamilySchema = z.enum(scenarioFamilies);
export const StepKindSchema = z.enum(stepKinds);
export const GuidanceStatusSchema = z.enum(guidanceStatuses);
export const GuidanceActionTypeSchema = z.enum(guidanceActionTypes);
export const StepMarkerSchema = z.enum(stepMarkers);

export const GuidanceActionSchema = z
  .object({
    type: GuidanceActionTypeSchema,
    // Wayfinding only: Atlas never executes work on the user's behalf
    // (guidance_design §5.9). Labels should read Open/View/Copy/Contact —
    // never Submit/Run/Apply/Create for external systems. The validate gate
    // surfaces violations as a soft warning rather than a hard schema error.
    label: z.string().min(1),
    /** atlas_page path, external/tool/support url. */
    target: z.string().min(1).optional(),
    /** source registry id for source_link. */
    ref: z.string().min(1).optional(),
    /** payload for copy_text. */
    text: z.string().min(1).optional(),
  })
  .strict();

export const GuidanceTaskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    required: z.boolean().optional(),
    action: GuidanceActionSchema.optional(),
  })
  .strict();

export const DecisionOptionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    /** atlas_page path the option routes to. */
    to: z.string().min(1).optional(),
  })
  .strict();

export const GuidanceStepSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: StepKindSchema,
    description: z.string().min(1).optional(),
    /** Why this step matters, shown above the task list. */
    why: z.string().min(1).optional(),
    tasks: z.array(GuidanceTaskSchema).optional(),
    /** source registry ids cited by this step. */
    sources: z.array(z.string().min(1)).optional(),
    support: z
      .object({ team: z.string().min(1), channel: z.string().min(1) })
      .strict()
      .optional(),
    /** decision-step branch options. */
    options: z.array(DecisionOptionSchema).optional(),
    marker: StepMarkerSchema.optional(),
  })
  .strict();

export const GuidanceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: GuidanceTypeSchema,
    scenario: z.string().min(1),
    family: ScenarioFamilySchema,
    objective: z.string().min(1),
    destination: z
      .object({ title: z.string().min(1), description: z.string().min(1).optional() })
      .strict(),
    owner: z.object({ team: z.string().min(1), support: z.string().min(1) }).strict(),
    status: GuidanceStatusSchema,
    version: z.string().min(1),
    last_reviewed: z.string().date(),
    applies_to: z
      .object({
        services: z.array(z.string().min(1)).optional(),
        landing_zones: z.array(z.string().min(1)).optional(),
        guardrails: z.array(z.string().min(1)).optional(),
      })
      .strict()
      .optional(),
    sources: z.array(z.string().min(1)).optional(),
    steps: z.array(GuidanceStepSchema).min(1),
  })
  .strict()
  .refine((g) => g.steps[g.steps.length - 1]?.kind === "destination", {
    message: "guidance.steps must end with a destination step",
    path: ["steps"],
  });

export const GuidanceResponseSchema = z.object({ guidance: GuidanceSchema }).strict();

export type SourceClass = z.infer<typeof SourceClassSchema>;
export type TopicType = z.infer<typeof TopicTypeSchema>;
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type AnchorStrategy = z.infer<typeof AnchorStrategySchema>;
export type TopicStatus = z.infer<typeof TopicStatusSchema>;
export type AnchorStatus = z.infer<typeof AnchorStatusSchema>;
export type FeedbackTargetType = z.infer<typeof FeedbackTargetTypeSchema>;
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type WarningCode = z.infer<typeof WarningCodeSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type Anchor = z.infer<typeof AnchorSchema>;
export type EntryTool = z.infer<typeof EntryToolSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type SourceTopicMapping = z.infer<typeof SourceTopicMappingSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
export type TopicResponse = z.infer<typeof TopicResponseSchema>;
export type SourceResponse = z.infer<typeof SourceResponseSchema>;
export type SourceDiscoveryRequest = z.infer<typeof SourceDiscoveryRequestSchema>;
export type SourceDiscoveryResponse = z.infer<typeof SourceDiscoveryResponseSchema>;
export type TopicDiscoveryRequest = z.infer<typeof TopicDiscoveryRequestSchema>;
export type TopicDiscoveryResponse = z.infer<typeof TopicDiscoveryResponseSchema>;
export type ContextRequest = z.infer<typeof ContextRequestSchema>;
export type ExpansionRequest = z.infer<typeof ExpansionRequestSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Excerpt = z.infer<typeof ExcerptSchema>;
export type ContextBundleSource = z.infer<typeof ContextBundleSourceSchema>;
export type AnchorReference = z.infer<typeof AnchorReferenceSchema>;
export type Warning = z.infer<typeof WarningSchema>;
export type ExpansionPath = z.infer<typeof ExpansionPathSchema>;
export type ContextBundleResponse = z.infer<typeof ContextBundleResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type GuidanceType = z.infer<typeof GuidanceTypeSchema>;
export type ScenarioFamily = z.infer<typeof ScenarioFamilySchema>;
export type StepKind = z.infer<typeof StepKindSchema>;
export type GuidanceStatus = z.infer<typeof GuidanceStatusSchema>;
export type GuidanceActionType = z.infer<typeof GuidanceActionTypeSchema>;
export type StepMarker = z.infer<typeof StepMarkerSchema>;
export type GuidanceAction = z.infer<typeof GuidanceActionSchema>;
export type GuidanceTask = z.infer<typeof GuidanceTaskSchema>;
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;
export type GuidanceStep = z.infer<typeof GuidanceStepSchema>;
export type Guidance = z.infer<typeof GuidanceSchema>;
export type GuidanceResponse = z.infer<typeof GuidanceResponseSchema>;

export {
  validateGuidanceDocument,
  validateGuidanceManifest,
  type GuidanceValidation,
  type ManifestIssue,
} from "./guidanceManifest.js";

export {
  validateSourceDocument,
  validateTopicDocument,
  validateAnchorDocument,
  validateMappingDocument,
  validateRegistryManifest,
  type DocumentValidation,
  type RegistryManifestInput,
  type RegistryManifestValidation,
} from "./registryManifest.js";
