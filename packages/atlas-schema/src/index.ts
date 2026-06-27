import { z } from "zod";

export const sourceClasses = [
  "terraform-module",
  "confluence-page",
  "policy-document",
  "availability-matrix",
] as const;

export const topicTypes = ["service", "landing-zone", "security-policy"] as const;

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
  // No such resource is registered on the kind-first resource surface; the
  // caller should resolve the canonical id via searchResources.
  "resource_not_found",
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
        security_policies: z.array(z.string().min(1)).optional(),
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

/* -------------------------------------------------------------------------- *
 * Resource projection contract (agent-facing, ADR-0013)
 *
 * The kind-first resource surface (`/api/resources/...`). Unlike the snake_case
 * internal Topic/Source API, the agent-facing resource API uses the camelCase
 * field names from the discovery proposal (§5.5–§5.7): `resolvedAt`,
 * `requestedSections`, `matchReason`, `resourceUrl`, … Reasons reuse the same
 * `warningCodes` vocabulary above — no parallel status words are invented.
 *
 * Two orthogonal axes (ADR-0013 §4):
 *   axis 1 — section.status ∈ available | partial | unresolved
 *   axis 2 — reasons via warnings[].code / missingSections[].code (warningCodes)
 * -------------------------------------------------------------------------- */

export const resourceKinds = ["service", "guardrail", "landing-zone"] as const;
export const sectionStatuses = ["available", "partial", "unresolved"] as const;

// Coarse, stable Section vocabulary (proposal §5.2.1). The union spans every
// kind; per-kind applicability is owned by the resource-kind registry and
// documented in the OpenAPI `sections` enum. A consistency test asserts the
// registry's section ids stay a subset of this union.
export const sectionIds = [
  // service kind — complete vocabulary
  "overview",
  "availability",
  "network",
  "security",
  "compliance",
  "pricing",
  "limits",
  "guidance",
  "examples",
  "sources",
  // guardrail kind — a non-service kind, proving the vocabulary is per-kind
  "scope",
  "enforced-controls",
  "exceptions",
  // landing-zone kind — environment/account baseline (its other sections reuse ids above)
  "environments",
  "baseline-controls",
  "lifecycle",
] as const;

export const ResourceKindSchema = z.enum(resourceKinds);
export const SectionStatusSchema = z.enum(sectionStatuses);
export const SectionIdSchema = z.enum(sectionIds);

export const ResourceCitationSchema = z
  .object({
    sourceId: z.string().min(1),
    title: z.string().min(1),
    url: z.string().min(1),
    anchor: z.string().min(1).optional(),
    // The moment the content was actually parsed from the Source. On a perf-cache
    // hit this is the ORIGINAL parse time frozen with the excerpt, never the
    // request time or cache-hit time (ADR-0013 §6).
    resolvedAt: z.string().datetime(),
  })
  .strict();

export const ResourceFactSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    value: z.union([z.string().min(1), z.array(z.string().min(1))]),
    status: z.string().min(1).optional(),
  })
  .strict();

export const ResourceWarningSchema = z
  .object({ code: WarningCodeSchema, message: z.string().min(1) })
  .strict();

export const ContextSectionSchema = z
  .object({
    // axis 1 — this projection's resolution result
    status: SectionStatusSchema,
    summary: z.string().min(1).optional(),
    content: z.string().min(1).nullable(),
    facts: z.array(ResourceFactSchema).optional(),
    citations: z.array(ResourceCitationSchema),
    // axis 2 — reasons (warningCodes), never a parallel status vocabulary
    warnings: z.array(ResourceWarningSchema),
  })
  .strict();

export const MissingSectionSchema = z
  .object({
    section: z.string().min(1),
    code: WarningCodeSchema,
    message: z.string().min(1),
  })
  .strict();

export const ResourceSummarySchema = z
  .object({
    kind: ResourceKindSchema,
    id: z.string().min(1), // canonical {kind}/{slug}
    slug: z.string().min(1), // kind-relative, e.g. "aws/textract"
    provider: z.string().min(1).optional(),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    resourceUrl: z.string().min(1),
    markdownUrl: z.string().min(1),
  })
  .strict();

export const ResourceSearchItemSchema = ResourceSummarySchema.extend({
  matchReason: z.string().min(1),
}).strict();

export const ResourceSearchResponseSchema = z
  .object({ items: z.array(ResourceSearchItemSchema) })
  .strict();

export const ResourceContextResponseSchema = z
  .object({
    resource: ResourceSummarySchema,
    requestedSections: z.array(z.string().min(1)),
    sections: z.record(z.string(), ContextSectionSchema),
    missingSections: z.array(MissingSectionSchema),
    // Top-level: the moment THIS live projection ran (ADR-0013 §3), distinct
    // from each citation's resolvedAt (the excerpt's own parse time).
    resolvedAt: z.string().datetime(),
  })
  .strict();

// Persisted projection record (data/resources.yaml). Holds references + rules,
// never Section content (ADR-0013 §2). snake_case matches the other manifests.
export const ResourceSectionBindingSchema = z
  .object({
    source_id: z.string().min(1),
    anchor_id: z.string().min(1).optional(),
    order: z.number().int().nonnegative(),
  })
  .strict();

export const ResourceContextRecordSchema = z
  .object({
    kind: ResourceKindSchema,
    slug: z.string().min(1),
    provider: z.string().min(1).optional(),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    // Identity / presentation metadata absorbed onto the Resource (ADR-0015 §2),
    // migrated off the Topic (these fields reuse TopicSchema's shapes). Optional
    // during migration; 15a tightens them to required once every Topic's metadata
    // has moved across. A Facet-only Topic has no Resource, so it never needs them.
    category: z.string().min(1).optional(),
    status: TopicStatusSchema.optional(),
    description: z.string().min(1).optional(),
    owner_team: z.string().min(1).optional(),
    support_channel: z.string().min(1).optional(),
    entry_tools: z.array(EntryToolSchema).optional(),
    // Facet tags — which Topics (now facets) this Resource belongs to, by id
    // reference only (ADR-0015 §3). The facet's labeled metadata stays on the
    // Topic record; the Resource just points at it.
    topics: z.array(z.string().min(1)).optional(),
    sections: z.record(z.string(), z.array(ResourceSectionBindingSchema).min(1)),
  })
  .strict();

export type ResourceKind = z.infer<typeof ResourceKindSchema>;
export type SectionStatus = z.infer<typeof SectionStatusSchema>;
export type SectionId = z.infer<typeof SectionIdSchema>;
export type ResourceCitation = z.infer<typeof ResourceCitationSchema>;
export type ResourceFact = z.infer<typeof ResourceFactSchema>;
export type ResourceWarning = z.infer<typeof ResourceWarningSchema>;
export type ContextSection = z.infer<typeof ContextSectionSchema>;
export type MissingSection = z.infer<typeof MissingSectionSchema>;
export type ResourceSummary = z.infer<typeof ResourceSummarySchema>;
export type ResourceSearchItem = z.infer<typeof ResourceSearchItemSchema>;
export type ResourceSearchResponse = z.infer<typeof ResourceSearchResponseSchema>;
export type ResourceContextResponse = z.infer<typeof ResourceContextResponseSchema>;
export type ResourceSectionBinding = z.infer<typeof ResourceSectionBindingSchema>;
export type ResourceContextRecord = z.infer<typeof ResourceContextRecordSchema>;

/* -------------------------------------------------------------------------- *
 * Regional availability (plan 014)
 *
 * The single availability read's wire shape. `AvailabilityResponse` is the grid
 * the Portal Explore surface and the MCP `atlas_get_availability` tool render
 * (zones -> services -> {location -> status}); `AvailabilityReadResponse` wraps
 * it with the governing Citation + warnings so every consumer reads ONE cited
 * source of record (ADR-0014). Coordinates/labels/iconKey are presentation that
 * rides along the same wire, keeping the grid self-contained for consumers.
 * -------------------------------------------------------------------------- */
export const locationKinds = ["region", "outpost"] as const;
export const locationStatuses = ["available", "planned", "interim", "not-planned"] as const;
export const landingZoneIds = ["aws", "azure"] as const;

export const LocationKindSchema = z.enum(locationKinds);
export const LocationStatusSchema = z.enum(locationStatuses);
export const LandingZoneIdSchema = z.enum(landingZoneIds);

export const LocationSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    sub: z.string(),
    kind: LocationKindSchema,
    /** [longitude, latitude] in degrees, used to place the location on the map. */
    coordinates: z.tuple([z.number(), z.number()]).optional(),
  })
  .strict();

export const LocationAvailabilitySchema = z
  .object({
    status: LocationStatusSchema,
    /** ETA label for planned, interim caveat note, etc. */
    note: z.string().min(1).optional(),
  })
  .strict();

export const AvailabilityRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    iconKey: z.string().min(1),
    domain: z.string().min(1),
    /** location id -> availability. A missing entry means `not-planned`. */
    availability: z.record(z.string(), LocationAvailabilitySchema).readonly(),
  })
  .strict();

export const LandingZoneDataSchema = z
  .object({
    id: LandingZoneIdSchema,
    name: z.string().min(1),
    locations: z.array(LocationSchema).readonly(),
    services: z.array(AvailabilityRecordSchema).readonly(),
  })
  .strict();

export const AvailabilityResponseSchema = z
  .object({
    zones: z.array(LandingZoneDataSchema).readonly(),
  })
  .strict();

export const AvailabilityReadResponseSchema = z
  .object({
    zones: z.array(LandingZoneDataSchema).readonly(),
    citation: CitationSchema,
    warnings: z.array(WarningSchema),
  })
  .strict();

export type LocationKind = z.infer<typeof LocationKindSchema>;
export type LocationStatus = z.infer<typeof LocationStatusSchema>;
export type LandingZoneId = z.infer<typeof LandingZoneIdSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type LocationAvailability = z.infer<typeof LocationAvailabilitySchema>;
export type AvailabilityRecord = z.infer<typeof AvailabilityRecordSchema>;
export type LandingZoneData = z.infer<typeof LandingZoneDataSchema>;
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
export type AvailabilityReadResponse = z.infer<typeof AvailabilityReadResponseSchema>;

export {
  validateGuidanceDocument,
  validateGuidanceManifest,
  type GuidanceValidation,
  type ManifestIssue,
} from "./guidanceManifest";

export {
  validateSourceDocument,
  validateTopicDocument,
  validateAnchorDocument,
  validateMappingDocument,
  validateRegistryManifest,
  type DocumentValidation,
  type RegistryManifestInput,
  type RegistryManifestValidation,
} from "./registryManifest";
