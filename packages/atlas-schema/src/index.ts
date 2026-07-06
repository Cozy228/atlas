import { z } from "zod";

export const sourceClasses = [
  "terraform-module",
  "confluence-page",
  "policy-document",
  "availability-matrix",
] as const;

export const authorityLevels = [
  "authoritative",
  "reference",
  "example",
  "draft",
  "deprecated",
] as const;

export const visibilityLevels = ["internal", "restricted"] as const;

export const resourceStatuses = ["active", "deprecated", "planned"] as const;
export const feedbackTargetTypes = ["resource", "source"] as const;
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
  // Governance-gate scope vetting (Step 1, M11). `scope_drift`: a by-value
  // declaration and its referenced AppRecord disagree (value wins, the reference
  // is advisory). `scope_unresolved`: a by-reference `appId` could not be resolved
  // through the AppDirectory (honest-empty — no app scope is seated).
  "scope_drift",
  "scope_unresolved",
  // Consumer-state dangling declarations (Step 3, M11). An APP's declared
  // `serviceSlugs` / `landingZoneIds` are stored VERBATIM and warned, never
  // dropped: a manifest legitimately declares a service Atlas has not discovered
  // yet, or a zone outside the topology — that gap is signal, not error.
  "unknown_service",
  "unknown_landing_zone",
] as const;

export const apiErrorCodes = [
  "source_not_found",
  "anchor_broken",
  "source_unavailable",
  "access_denied",
  // No such resource is registered on the kind-first resource surface; the
  // caller should resolve the canonical id via searchResources.
  "resource_not_found",
  // No such registered APP (Step 3). An APP is a scope entity, not a Resource
  // (mid-level §1 NodeRef), so `resource_not_found` must not blur that boundary.
  "app_not_found",
  "invalid_request",
] as const;

export const SourceClassSchema = z.enum(sourceClasses);
export const AuthorityLevelSchema = z.enum(authorityLevels);
export const VisibilitySchema = z.enum(visibilityLevels);
export const ResourceStatusSchema = z.enum(resourceStatuses);
export const FeedbackTargetTypeSchema = z.enum(feedbackTargetTypes);
export const FeedbackTypeSchema = z.enum(feedbackTypes);
export const WarningCodeSchema = z.enum(warningCodes);
export const ApiErrorCodeSchema = z.enum(apiErrorCodes);

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
    // Presentation category — the domain of the thing this source documents (a
    // service's availability domain, or "Security" for a policy). Used to group
    // the source registry by category. Optional: a source with no derivable
    // category groups under "Other".
    category: z.string().min(1).optional(),
    visibility: VisibilitySchema,
    // Authority deferred end-to-end (plan 019): discovery's entry scope already
    // crawls only authoritative sources, so authority is not a required per-source
    // attribute. The vocabulary (AuthorityLevel / authority_conflict) is kept
    // dormant for later contributed-content authority, not deleted.
    authority_scope: z.array(z.string().min(1)).min(1).optional(),
    authority_level: AuthorityLevelSchema.optional(),
    last_observed_at: z.string().datetime(),
    last_reviewed_at: z.string().datetime(),
    review_frequency: z.string().min(1),
    // The source-of-record version Atlas last recorded for this Source. When
    // the live page version exceeds it, runtime resolution emits stale_source
    // (drift). Optional: with no recorded version, drift never fires.
    observed_version: z.number().int().nonnegative().optional(),
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

export const SourceResponseSchema = z
  .object({
    source: SourceSchema,
  })
  .strict();

export const SourceDiscoveryRequestSchema = z
  .object({
    query: z.string().min(1).optional(),
    source_class: SourceClassSchema.optional(),
  })
  .strict();

export const SourceDiscoveryResponseSchema = z
  .object({
    sources: z.array(SourceSchema),
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

export const WarningSchema = z
  .object({
    code: WarningCodeSchema,
    message: z.string().min(1),
    source_id: z.string().min(1).optional(),
    anchor_id: z.string().min(1).optional(),
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
 * enters the registry. snake_case matches the Source API convention.
 *
 * A guidance is a flat, linear onboarding journey: Guidance -> steps -> tasks.
 * There is no step-kind taxonomy (decision/checklist/destination) and no
 * top-level renderer `type` — Confluence prose, the source of truth, cannot
 * carry those markers, so the model stays at what authored pages can express.
 * -------------------------------------------------------------------------- */

export const scenarioFamilies = ["onboard", "decide", "enable", "validate"] as const;
export const guidanceStatuses = ["draft", "published", "needs_review", "deprecated"] as const;
export const guidanceActionTypes = [
  "atlas_page",
  "external_link",
  "source_link",
  "tool_link",
  "support_link",
  "copy_text",
] as const;

export const ScenarioFamilySchema = z.enum(scenarioFamilies);
export const GuidanceStatusSchema = z.enum(guidanceStatuses);
export const GuidanceActionTypeSchema = z.enum(guidanceActionTypes);

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

/* -------------------------------------------------------------------------- *
 * Step body — structured content blocks
 *
 * A step's optional `body` carries an authored source page's content (prose,
 * nested lists, typed links, image refs) LOSSLESSLY, as a small closed set of
 * stepper-native, interactive blocks — NOT a faithful HTML/Confluence document
 * mirror. Presentation markup (bold/underline, indentation, ids) is dropped;
 * meaning (headings, paragraphs, list nesting, typed links, image references)
 * is kept. Additive: store-authored journeys omit `body` and are unaffected.
 *
 * A `confluence-page` link is a reference by title/space with no resolvable URL
 * (Confluence resolves it internally) — surfaced as an honest, non-navigable
 * reference, never a fabricated link.
 * -------------------------------------------------------------------------- */

export const GuidanceLinkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("external"), url: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("email"), address: z.string().min(1) }).strict(),
  z
    .object({
      kind: z.literal("confluence-page"),
      title: z.string().min(1),
      space: z.string().min(1).optional(),
    })
    .strict(),
]);
export type GuidanceLink = z.infer<typeof GuidanceLinkSchema>;

/** An inline run of text, optionally the anchor text of a typed link. */
export const GuidanceSpanSchema = z
  .object({ text: z.string().min(1), link: GuidanceLinkSchema.optional() })
  .strict();
export type GuidanceSpan = z.infer<typeof GuidanceSpanSchema>;

// Recursive block/list-item types are hand-written so the `z.lazy` schemas below
// can annotate themselves (Zod cannot infer a recursive type on its own).
export type GuidanceBlock =
  | { kind: "heading"; text: string }
  | { kind: "prose"; spans: GuidanceSpan[] }
  | { kind: "list"; ordered: boolean; items: GuidanceListItem[] }
  | { kind: "image"; filename: string; alt?: string };
export type GuidanceListItem = { spans: GuidanceSpan[]; blocks?: GuidanceBlock[] };

/** A list item: its own inline text plus any nested blocks (sub-lists, prose). */
export const GuidanceListItemSchema: z.ZodType<GuidanceListItem> = z.lazy(() =>
  z
    .object({
      spans: z.array(GuidanceSpanSchema),
      blocks: z.array(GuidanceBlockSchema).min(1).optional(),
    })
    .strict(),
);

/** A content block in document order (heading, paragraph, list, or image ref). */
export const GuidanceBlockSchema: z.ZodType<GuidanceBlock> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("heading"), text: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("prose"), spans: z.array(GuidanceSpanSchema).min(1) }).strict(),
    z
      .object({
        kind: z.literal("list"),
        ordered: z.boolean(),
        items: z.array(GuidanceListItemSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("image"),
        filename: z.string().min(1),
        alt: z.string().min(1).optional(),
      })
      .strict(),
  ]),
);

// A task can nest checkable sub-tasks (a source list tree), so the type is
// hand-written and the schema is `z.lazy` — Zod cannot infer a recursive type.
export type GuidanceTask = {
  id: string;
  title: string;
  required?: boolean;
  action?: GuidanceAction;
  group?: string;
  detail?: GuidanceBlock[];
  subtasks?: GuidanceTask[];
};

export const GuidanceTaskSchema: z.ZodType<GuidanceTask> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      required: z.boolean().optional(),
      /** The task's primary action — a verb-rule button (Open / View / Contact /
       *  Copy). Parsed from a source page's link (typed by href) or authored by
       *  the store. A Confluence-internal page reference links to a wiki search. */
      action: GuidanceActionSchema.optional(),
      /** Sub-header this task sits under within its step (a source page's `<h2>`
       *  grouping). Consecutive tasks sharing a `group` render under one label. */
      group: z.string().min(1).optional(),
      /** The task's own detail — the leaf's non-actionable content (link-less
       *  sub-lists, further prose, image refs), rendered under the checkbox. */
      detail: z.array(GuidanceBlockSchema).min(1).optional(),
      /** Nested checkable sub-tasks mirroring a source list's actionable items. */
      subtasks: z.array(GuidanceTaskSchema).min(1).optional(),
    })
    .strict(),
);

export const GuidanceStepSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    /** Why this step matters, shown above the task list. */
    why: z.string().min(1).optional(),
    tasks: z.array(GuidanceTaskSchema).optional(),
    /** Sub-header groups within the step (a source page's `<h2>`s), carrying the
     *  intro prose that names each cluster of tasks. Tasks reference a group by
     *  its `label`; entries here add the group's optional description. */
    groups: z
      .array(
        z.object({ label: z.string().min(1), description: z.string().min(1).optional() }).strict(),
      )
      .optional(),
    /** source registry ids cited by this step. */
    sources: z.array(z.string().min(1)).optional(),
    /** Structured content preserved from an authored source page (see above). */
    body: z.array(GuidanceBlockSchema).min(1).optional(),
  })
  .strict();

export const GuidanceSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    scenario: z.string().min(1),
    family: ScenarioFamilySchema,
    objective: z.string().min(1),
    /** The journey's end-state — its goal, rendered as the closing card. */
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
  .strict();

export const GuidanceResponseSchema = z.object({ guidance: GuidanceSchema }).strict();

export type SourceClass = z.infer<typeof SourceClassSchema>;
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;
export type Visibility = z.infer<typeof VisibilitySchema>;
export type ResourceStatus = z.infer<typeof ResourceStatusSchema>;
export type FeedbackTargetType = z.infer<typeof FeedbackTargetTypeSchema>;
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type WarningCode = z.infer<typeof WarningCodeSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type EntryTool = z.infer<typeof EntryToolSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Feedback = z.infer<typeof FeedbackSchema>;
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
export type SourceResponse = z.infer<typeof SourceResponseSchema>;
export type SourceDiscoveryRequest = z.infer<typeof SourceDiscoveryRequestSchema>;
export type SourceDiscoveryResponse = z.infer<typeof SourceDiscoveryResponseSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type Warning = z.infer<typeof WarningSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ScenarioFamily = z.infer<typeof ScenarioFamilySchema>;
export type GuidanceStatus = z.infer<typeof GuidanceStatusSchema>;
export type GuidanceActionType = z.infer<typeof GuidanceActionTypeSchema>;
export type GuidanceAction = z.infer<typeof GuidanceActionSchema>;
// GuidanceTask is hand-written (recursive) above, beside its schema.
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

/* -------------------------------------------------------------------------- *
 * Convention-driven Confluence reference discovery (plan 017, ADR-0016)
 *
 * A NEW narrow surface that lives ALONGSIDE the governed Registry, never inside
 * it (decision #1): the strict `SourceSchema` stays reference-unaware. A
 * `DiscoveredReference` is a reference-only document link — the agent learns a
 * page EXISTS, never that its body was obtained (`content_mode: "reference_only"`,
 * `agent_accessible: false`). `ServiceIdentity` is the availability-spine tuple
 * normalized into a canonical `{provider}/{id}` key plus the two alias tiers the
 * discovery pipeline keys on: wide `recallAliases` (CQL search only) and narrow
 * `admissionAliases` (the gate that re-filters fuzzy recall, B8/B9).
 * -------------------------------------------------------------------------- */
export const docTypes = ["design", "user-guide", "policy"] as const;

export const DocTypeSchema = z.enum(docTypes);

export const ServiceIdentitySchema = z
  .object({
    provider: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    // `${provider}/${id}` — exactly the service-kind `slug` under ADR-0015's
    // `{kind}/{slug}` addressing. Formed from the spine tuple alone; the
    // `resources.yaml` overlay is never required to produce it (decision #3).
    key: z.string().min(1),
    // Search-only: aliases handed to CQL `title ~` for wide recall (the bare
    // machine slug is recall-eligible here).
    recallAliases: z.array(z.string().min(1)),
    // Gate-only: stable human product names + explicit abbreviations. The bare
    // machine slug is NEVER admission-eligible (B8). After recall, a candidate
    // title must contain a complete admissionAlias token-sequence to be admitted.
    admissionAliases: z.array(z.string().min(1)),
  })
  .strict();

export const DiscoveredReferenceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().min(1), // page webui url
    doc_type: DocTypeSchema,
    last_observed_at: z.string().datetime(), // ISO — when the link was last observed
    // Honesty fields (decision #1, §Honesty): a reference is a link, not content.
    content_mode: z.literal("reference_only"),
    access_mode: z.literal("service_credentials"),
    agent_accessible: z.literal(false),
    confidence: z.number().min(0).max(1).optional(), // unset in the Preview phase
  })
  .strict();

// Reference-discovery cache/freshness state (decision #5, B12). Surfaced on the
// response so a consumer can NEVER mistake an empty list for a healthy "no docs"
// answer: `unavailable` (past max-staleness, cache dead) and `incomplete`
// (recall truncated at the cap) are explicit, never a silent stale link list.
export const referenceDiscoveryStatuses = ["fresh", "stale", "unavailable"] as const;
export const ReferenceDiscoveryStatusSchema = z.enum(referenceDiscoveryStatuses);

export const ReferenceDiscoveryStateSchema = z
  .object({
    status: ReferenceDiscoveryStatusSchema,
    last_observed_at: z.string().datetime().nullable(),
    incomplete: z.boolean(),
  })
  .strict();

export const ResourceContextResponseSchema = z
  .object({
    resource: ResourceSummarySchema,
    requestedSections: z.array(z.string().min(1)),
    sections: z.record(z.string(), ContextSectionSchema),
    missingSections: z.array(MissingSectionSchema),
    // Reference-only document links discovered ALONGSIDE governed sources (B5).
    // Flat; each carries its own `doc_type` — the UI groups, the schema does not.
    references: z.array(DiscoveredReferenceSchema),
    // Discovery cache/freshness state for `references`; `null` when no discovery
    // ran (non-service kinds, or no discovery adapter wired). Lets a consumer
    // distinguish "fresh, no docs" from "unavailable" / "incomplete" (§Honesty).
    referenceDiscovery: ReferenceDiscoveryStateSchema.nullable(),
    // Top-level: the moment THIS live projection ran (ADR-0013 §3), distinct
    // from each citation's resolvedAt (the excerpt's own parse time).
    resolvedAt: z.string().datetime(),
  })
  .strict();

// Resource projection record (derived from discovery, plan 018 G5). Holds
// references + rules, never Section content (ADR-0013 §2); snake_case shape.
export const ResourceSectionBindingSchema = z
  .object({
    source_id: z.string().min(1),
    // Section entry heading — a DEFAULT entry point, not a fixed address. The
    // resolver slugifies it and locates the section at runtime by heading-slug
    // scan (anchor "3 去"); the agent may request any heading beyond this vocab.
    heading: z.string().min(1).optional(),
    // Structured selector for sources NOT located by heading: the availability
    // matrix (service/region) and terraform module fields (field).
    selector: z.record(z.string(), z.string()).optional(),
    // Citation label for the resolved excerpt (was the Anchor's citation_label).
    citation_label: z.string().min(1).optional(),
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
    // Identity / presentation metadata derived from discovery (ADR-0015 §2).
    // Optional = honest-gap: only what discovery can back is set (category from
    // the availability domain, a module entry tool), never fabricated.
    category: z.string().min(1).optional(),
    status: ResourceStatusSchema.optional(),
    description: z.string().min(1).optional(),
    owner_team: z.string().min(1).optional(),
    support_channel: z.string().min(1).optional(),
    entry_tools: z.array(EntryToolSchema).optional(),
    sections: z.record(z.string(), z.array(ResourceSectionBindingSchema).min(1)),
  })
  .strict();

/**
 * Resource record read (ADR-0015 §1/§2). The Portal-facing presentation metadata
 * for a Resource — identity/owner/entry fields derived from discovery. Distinct
 * from `ResourceContextResponse`, which stays content-only (ADR-0015 §1): the
 * resource-first page composes record-metadata (THIS read) + resolved content
 * (`getResourceContext`). The same record shape lists in the catalog
 * (`ResourceCatalogResponse`). Presentation fields are optional = honest-gap.
 */
export const ResourceRecordResponseSchema = z
  .object({
    kind: ResourceKindSchema,
    id: z.string().min(1), // canonical {kind}/{slug}
    slug: z.string().min(1),
    provider: z.string().min(1).optional(),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    category: z.string().min(1).optional(),
    status: ResourceStatusSchema.optional(),
    description: z.string().min(1).optional(),
    owner_team: z.string().min(1).optional(),
    support_channel: z.string().min(1).optional(),
    entry_tools: z.array(EntryToolSchema).optional(),
  })
  .strict();

/**
 * Resource catalog list (the discovery-derived catalog feed). Returns the same
 * per-resource presentation record as the single-record read — the Portal catalog
 * facets on `category`, tabs on `kind`, and links by `slug`; an agent can browse
 * the full resource inventory in one call.
 */
export const ResourceCatalogResponseSchema = z
  .object({
    resources: z.array(ResourceRecordResponseSchema),
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
export type DocType = z.infer<typeof DocTypeSchema>;
export type ServiceIdentity = z.infer<typeof ServiceIdentitySchema>;
export type DiscoveredReference = z.infer<typeof DiscoveredReferenceSchema>;
export type ReferenceDiscoveryStatus = z.infer<typeof ReferenceDiscoveryStatusSchema>;
export type ReferenceDiscoveryState = z.infer<typeof ReferenceDiscoveryStateSchema>;
export type ResourceContextResponse = z.infer<typeof ResourceContextResponseSchema>;
export type ResourceSectionBinding = z.infer<typeof ResourceSectionBindingSchema>;
export type ResourceContextRecord = z.infer<typeof ResourceContextRecordSchema>;
export type ResourceRecordResponse = z.infer<typeof ResourceRecordResponseSchema>;
export type ResourceCatalogResponse = z.infer<typeof ResourceCatalogResponseSchema>;

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

export const LocationKindSchema = z.enum(locationKinds);
export const LocationStatusSchema = z.enum(locationStatuses);

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

/* -------------------------------------------------------------------------- *
 * Landing zone topology (ADR-0017, plan 021)
 *
 * The landing zone is the discovery root: the ONE hardcoded input from which
 * availability, services, and links are discovered. This schema holds the LZ
 * *shape* only — the `LANDING_ZONES` constant lives in
 * `context-layer/src/landingZones/` (config, dev=prod), never a dev seed nor a
 * `data/*.yaml`. `id` is a named cloud×environment target (e.g. "awsf"); `cloud`
 * (region-carrying) and `tier` are attributes, not identity (decision #2) — an LZ
 * never spans clouds. `dataStatus` is honesty (ADR-0006): "not-available" is a
 * registered target with no wired availability source, never a hidden LZ.
 * -------------------------------------------------------------------------- */
export const landingZoneClouds = ["aws", "azure"] as const;
export const landingZoneDataStatuses = ["available", "not-available"] as const;

export const LandingZoneCloudSchema = z.enum(landingZoneClouds);
export const LandingZoneDataStatusSchema = z.enum(landingZoneDataStatuses);

export const LandingZoneSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    cloud: LandingZoneCloudSchema,
    tier: z.string().min(1).optional(),
    dataStatus: LandingZoneDataStatusSchema,
  })
  .strict();

/**
 * A landing zone's availability grid: the LZ topology + its discovered services
 * × locations. `id` is the LZ id (e.g. "awsf") and `cloud` an attribute — the
 * rename of the old `LandingZoneData` (id=cloud) misnomer (plan 021 B4). An
 * unwired LZ (`dataStatus: "not-available"`) carries empty `locations`/`services`
 * — an honest per-LZ dead-end (ADR-0006), never another LZ's data.
 */
export const LandingZoneAvailabilitySchema = LandingZoneSchema.extend({
  locations: z.array(LocationSchema).readonly(),
  services: z.array(AvailabilityRecordSchema).readonly(),
}).strict();

export const AvailabilityResponseSchema = z
  .object({
    zones: z.array(LandingZoneAvailabilitySchema).readonly(),
  })
  .strict();

export const AvailabilityReadResponseSchema = z
  .object({
    zones: z.array(LandingZoneAvailabilitySchema).readonly(),
    citation: CitationSchema,
    warnings: z.array(WarningSchema),
  })
  .strict();

export type LocationKind = z.infer<typeof LocationKindSchema>;
export type LocationStatus = z.infer<typeof LocationStatusSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type LocationAvailability = z.infer<typeof LocationAvailabilitySchema>;
export type AvailabilityRecord = z.infer<typeof AvailabilityRecordSchema>;
export type LandingZoneCloud = z.infer<typeof LandingZoneCloudSchema>;
export type LandingZoneDataStatus = z.infer<typeof LandingZoneDataStatusSchema>;
export type LandingZone = z.infer<typeof LandingZoneSchema>;
export type LandingZoneAvailability = z.infer<typeof LandingZoneAvailabilitySchema>;
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
export type AvailabilityReadResponse = z.infer<typeof AvailabilityReadResponseSchema>;

/* -------------------------------------------------------------------------- *
 * Consumer state — AppRecord + the repo manifest (Step 3: P17/P21/P26, M3/M11)
 *
 * The APP is the situation entry: a durable, self-declared, always-labeled
 * consumer-state record mapping to a landing-zone *set* (P26). The repo
 * manifest (`atlas.app.yaml`, P21) declares the same set by value; its field
 * names deliberately match Step 1's by-value `ScopeInput` vocabulary
 * (`landingZones` / `services`). `origin` is set by the server, never by the
 * caller; `"registry"` exists in the enum from day one (the P17 in-place
 * upgrade seat) but nothing writes it in Step 3.
 *
 * Every object schema is `.strict()`: a caller-supplied `origin`/`id` or any
 * unknown field is structural invalidity (400 at the routes), and the manifest
 * spec is frozen into team repos so it rejects stray fields too. `landingZoneIds`
 * / `landingZones` are non-empty sets (P26); `serviceSlugs` is required on the
 * record but may be empty. `origin` is server-set — it lives on the record and
 * the manifest's `appId` seat, never on a write request.
 * -------------------------------------------------------------------------- */

export const appOrigins = ["self-declared", "registry"] as const;
export const AppOriginSchema = z.enum(appOrigins);

/** Durable consumer-state record (mid-level §1). Never Evidence, always labeled. */
export const AppRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    // P26: an APP maps to a landing-zone SET; an LZ id carries its cloud identity.
    landingZoneIds: z.array(z.string().min(1)).min(1),
    // Declared services-in-use (service-kind slugs, e.g. "aws/textract"); empty
    // is legal (a freshly declared APP may not name any service yet).
    serviceSlugs: z.array(z.string().min(1)),
    // Server-set provenance label; drives the unconditional `self-declared` badge.
    origin: AppOriginSchema,
    declaredAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

/**
 * The repo manifest (`atlas.app.yaml` at the consuming repo's root, P21/M11).
 * fs-free like `guidanceManifest`: callers parse YAML and pass the object in.
 * An agent reads it and passes `landingZones`/`services` BY VALUE — zero
 * registration, never a write. After explicit registration the team commits
 * the returned `appId` back into the manifest themselves (PR is the
 * maintenance surface); Atlas never writes to a team repo. Field names match
 * Step 1's by-value `ScopeInput` vocabulary on purpose.
 */
export const AppManifestSchema = z
  .object({
    name: z.string().min(1),
    landingZones: z.array(z.string().min(1)).min(1),
    services: z.array(z.string().min(1)).optional(),
    appId: z.string().min(1).optional(),
  })
  .strict();

/** POST /api/apps body. `origin`/`id` are server-owned: supplying them is a 400. */
export const AppRegistrationRequestSchema = z
  .object({
    name: z.string().min(1),
    landingZoneIds: z.array(z.string().min(1)).min(1),
    serviceSlugs: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** PATCH /api/apps/{id} body: partial update, at least one mutable field. */
export const AppUpdateRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    landingZoneIds: z.array(z.string().min(1)).min(1).optional(),
    serviceSlugs: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "an update must change at least one field",
  });

/** GET /api/apps/{id} body. */
export const AppResponseSchema = z.object({ app: AppRecordSchema }).strict();
/** POST/PATCH body: the stored record plus the dangling-declaration warnings
 *  (`unknown_service` / `unknown_landing_zone`) — kept verbatim, warned, never
 *  dropped (locked decision 5). */
export const AppMutationResponseSchema = z
  .object({ app: AppRecordSchema, warnings: z.array(WarningSchema) })
  .strict();
/** GET /api/apps body. */
export const AppListResponseSchema = z.object({ apps: z.array(AppRecordSchema) }).strict();

export type AppOrigin = z.infer<typeof AppOriginSchema>;
export type AppRecord = z.infer<typeof AppRecordSchema>;
export type AppManifest = z.infer<typeof AppManifestSchema>;
export type AppRegistrationRequest = z.infer<typeof AppRegistrationRequestSchema>;
export type AppUpdateRequest = z.infer<typeof AppUpdateRequestSchema>;
export type AppResponse = z.infer<typeof AppResponseSchema>;
export type AppMutationResponse = z.infer<typeof AppMutationResponseSchema>;
export type AppListResponse = z.infer<typeof AppListResponseSchema>;

/* -------------------------------------------------------------------------- *
 * The graph layer — versioned graph + change feed (Step 2: I1, M1/M6/M10, P31)
 *
 * The platform's truth is a versioned, aging, self-witnessing graph derived
 * from the three landed source roots (availability page per LZ, the TFE module
 * probe set, the guardrail Confluence space). `deriveGraph` turns per-root
 * snapshots into a content-hashed `GraphVersion`; the differ turns two
 * successive versions into `ChangeEvent`s over a CLOSED `EventClass` set; the
 * change feed reads the durable `events` store scoped by `ctx.scope`.
 *
 * Closed vocabulary, grounded in what discovery actually witnesses today (P22
 * growth axis — this set grows only when a new adapter witnesses a new delta
 * kind, never speculatively):
 *   nodes  = service | landingZone | module | guardrail
 *   edges  = available-in (service→LZ) | uses-module (service→module)
 *            | governed-by (service→guardrail)
 *
 * NOTE (doc reconciliation, 2026-07-05): mid-level-design §1 sketches an older,
 * broader event vocabulary (`catalog-added`, `availability-changed`, …) framed
 * on the eventual full graph (app-*, guidance, location edges). Step 2's goal
 * prompt (newer, and DoD-encoded at D4) narrows to the closed set below,
 * grounded in the three LANDED sources. The narrower set wins here; the broader
 * set returns as adapters land their deltas. Flagged for the reviewer.
 * -------------------------------------------------------------------------- */

export const graphNodeKinds = ["service", "landingZone", "module", "guardrail"] as const;
export const graphEdgeTypes = ["available-in", "uses-module", "governed-by"] as const;

export const GraphNodeKindSchema = z.enum(graphNodeKinds);
export const GraphEdgeTypeSchema = z.enum(graphEdgeTypes);

/** A stable reference to a graph node: its kind + its stable id (a service
 *  slug `aws/textract`, an LZ id `awsf`, a module address, a guardrail slug). */
export const GraphNodeRefSchema = z
  .object({ kind: GraphNodeKindSchema, id: z.string().min(1) })
  .strict();

/** A graph node — a node ref plus its display name (presentation only). */
export const GraphNodeSchema = GraphNodeRefSchema.extend({
  name: z.string().min(1),
}).strict();

/**
 * A directed graph edge with per-edge provenance (P14: every edge answers
 * "where was I discovered from"). `from`/`to` are node ids; `rootId` names the
 * source root that witnessed the edge and `resolvedAt` is that root's parse
 * clock. `version` (module edges only) carries the module's published version,
 * so a version change is a value delta on a stable edge, not an edge churn.
 */
export const GraphEdgeSchema = z
  .object({
    type: GraphEdgeTypeSchema,
    from: z.string().min(1),
    to: z.string().min(1),
    rootId: z.string().min(1),
    resolvedAt: z.string().datetime(),
    version: z.string().min(1).optional(),
  })
  .strict();

/** Per-root freshness on a graph version: the root's parse clock + whether it
 *  is being served stale (last-good after a failed refresh — decision 8). */
export const PerRootFreshnessSchema = z
  .object({
    rootId: z.string().min(1),
    resolvedAt: z.string().datetime(),
    stale: z.boolean(),
  })
  .strict();

/**
 * A versioned graph (I1). `version` is a stable CONTENT hash of the inputs, so
 * identical snapshots ⇒ identical version and a changed snapshot ⇒ a new
 * version. Every request pins ONE version at entry; the registry and resource
 * records are byte-stable projections of it.
 */
export const GraphVersionSchema = z
  .object({
    version: z.string().min(1),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
    perRootFreshness: z.array(PerRootFreshnessSchema),
  })
  .strict();

/**
 * The closed `EventClass` set (P13/P22). A slug rename surfaces honestly as
 * `service-removed` + `service-added` (discovery cannot see intent — M6).
 * `uses-module` edges never emit add/remove events — the only module-edge delta
 * that is Evidence is a published-version change (`module-version-changed`).
 */
export const eventClasses = [
  "service-added",
  "service-removed",
  "available-in-added",
  "available-in-removed",
  "module-version-changed",
  "governed-by-added",
  "governed-by-removed",
] as const;
export const EventClassSchema = z.enum(eventClasses);

/**
 * A derived change (M1). Append-only, durable, idempotent: `id` is a content
 * hash of `(class, subject, object, from, to, graphVersionFrom→To)` so a
 * re-derivation of the same transition is a no-op conditional put.
 *
 *   - `subject`  the node the event is about (the service for edge/version
 *                events; the added/removed node for node events).
 *   - `object`   the related node for edge events: the LZ (available-in), the
 *                guardrail (governed-by), the module (module-version-changed).
 *   - `landingZoneIds`  the zones the subject touches at the moment of the
 *                event — the scope-filter key (M8/decision 6). An empty set is
 *                only ever visible on an unscoped read.
 *   - `from`/`to`  the value delta for `module-version-changed` (the published
 *                version strings); unset for structural add/remove events.
 *   - `rootId` + `graphVersionFrom`/`graphVersionTo` + `derivedAt`  provenance:
 *                which root witnessed it, across which two graph versions.
 */
export const ChangeEventSchema = z
  .object({
    id: z.string().min(1),
    class: EventClassSchema,
    subject: GraphNodeRefSchema,
    object: GraphNodeRefSchema.optional(),
    landingZoneIds: z.array(z.string().min(1)),
    from: z.string().min(1).optional(),
    to: z.string().min(1).optional(),
    rootId: z.string().min(1),
    graphVersionFrom: z.string().min(1),
    graphVersionTo: z.string().min(1),
    derivedAt: z.string().datetime(),
  })
  .strict();

/**
 * Per-root substrate freshness on the change feed (Step-2 tail, decision 8 /
 * D10). One entry per source root — `stale` is recomputed at read time from
 * `resolvedAt` vs now (never stored), and `agingNote` names a root being served
 * last-good after a failed refresh so the portal can raise a loud banner. Events
 * are scope-filtered, but substrate health is GLOBAL: `roots` carries every root.
 */
export const ChangeFeedRootSchema = z
  .object({
    rootId: z.string().min(1),
    resolvedAt: z.string().datetime(),
    stale: z.boolean(),
    agingNote: z.string().min(1).optional(),
  })
  .strict();

/**
 * The change-feed read (M8). `events` are ordered oldest→newest; `cursor` is
 * the opaque incremental read position (the last event's time index), `null`
 * when the feed is empty. `GET /api/changes?since=<cursor>` walks forward.
 * `roots` carries per-root substrate freshness (all roots — decision 8/D10).
 */
export const ChangesResponseSchema = z
  .object({
    events: z.array(ChangeEventSchema),
    cursor: z.string().min(1).nullable(),
    roots: z.array(ChangeFeedRootSchema),
  })
  .strict();

export type GraphNodeKind = z.infer<typeof GraphNodeKindSchema>;
export type GraphEdgeType = z.infer<typeof GraphEdgeTypeSchema>;
export type GraphNodeRef = z.infer<typeof GraphNodeRefSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type PerRootFreshness = z.infer<typeof PerRootFreshnessSchema>;
export type GraphVersion = z.infer<typeof GraphVersionSchema>;
export type EventClass = z.infer<typeof EventClassSchema>;
export type ChangeEvent = z.infer<typeof ChangeEventSchema>;
export type ChangeFeedRoot = z.infer<typeof ChangeFeedRootSchema>;
export type ChangesResponse = z.infer<typeof ChangesResponseSchema>;

/* -------------------------------------------------------------------------- *
 * Moment briefs — L3/L4 assembly + representation (Step 4: I3/I4, M4/M5/M9,
 * P26/P28)
 *
 * A `Brief` is the one serialized value every surface consumes (I3): the pure
 * template plans `BlockRequest[]` (graph + scope), the bounded-concurrency
 * executor resolves them into `BriefBlock[]`, and this shape is what
 * `GET /api/briefs/{moment}`, `/briefs/{moment}.md`, and the Portal page props
 * all render — byte-identically, so face drift is structurally inexpressible.
 *
 * Reuse discipline (locked decision 1): the two-axis status is `sectionStatuses`
 * (`available | partial | unresolved`); reasons are `warningCodes` via
 * `ResourceWarning` — NO parallel status vocabulary. Evidence (cited section
 * content) and pointers (`OperationalLocation`) are SEPARATE arrays by
 * construction — the ADR-0003 line is a type property, not a style rule.
 * -------------------------------------------------------------------------- */

export const moments = ["adopt", "build", "debug", "change"] as const;
export const MomentSchema = z.enum(moments);

/**
 * `?depth=citations|excerpts` is an acceptance property, not an option (M9/P28).
 * `citations` returns structure + citations with NO excerpt bodies (the agent
 * face is consumable without paying excerpt cost); `excerpts` includes bodies
 * (the human render default).
 */
export const briefDepths = ["citations", "excerpts"] as const;
export const BriefDepthSchema = z.enum(briefDepths);

/**
 * The situation's scope-provenance. NOTE (doc reconciliation, flagged for review,
 * 2026-07-05): mid-level §1 writes `Brief.situation.origin` without pinning its
 * enum, while listing `AppRecord.origin ∈ self-declared|registry`. The situation
 * is built from the wired `ctx.scope.origin` (Step 1 governance gate), whose
 * closed values are `by-value|by-reference` — how the scope entered (manifest
 * value vs a registered `appId`). This schema carries THAT value, so the
 * executor maps `ctx.scope.origin → situation.origin` directly with no
 * consumer-state read (P30: consumer state is never Evidence). It is deliberately
 * NOT `AppOrigin` (that is the AppRecord's provenance label, a different axis).
 */
export const situationOrigins = ["by-value", "by-reference"] as const;
export const SituationOriginSchema = z.enum(situationOrigins);

/**
 * `OperationalLocation` (mid-level §1; ADR-0003 pointer seat). A pointer record:
 * its *existence* is discovered with provenance; any *value* fetched through it
 * is operational status — uncited, never stored, never Evidence. Empty/unused
 * until Step 7 fills it (the debug floor); the schema lands now so `pointers[]`
 * has a type from the first line. `system` is open-ended ("tfe" | "harness" | …);
 * the value channel + auth mode is the owning adapter's property (M12), never an
 * arbitrary URL GET.
 */
export const operationalLocationKinds = [
  "workspace",
  "pipeline",
  "logs",
  "dashboard",
  "runbook",
] as const;
export const OperationalLocationKindSchema = z.enum(operationalLocationKinds);

export const OperationalLocationSchema = z
  .object({
    id: z.string().min(1),
    system: z.string().min(1),
    kind: OperationalLocationKindSchema,
    url: z.string().min(1),
    discoveredFrom: z.string().min(1),
  })
  .strict();

/**
 * One piece of cited section content inside a block (the "join" a block delivers,
 * P28 — never re-serving repo-discoverable content). `citations` are always
 * present (structure + citations survive at `depth=citations`); `excerpt` is the
 * resolved section body, non-null ONLY at `depth=excerpts` and `null` at
 * `depth=citations` (M9). On a perf-cache hit each citation's `resolvedAt` is the
 * original parse time frozen with the excerpt (ADR-0013 §6), never the request
 * time.
 */
export const BriefEvidenceSchema = z
  .object({
    // The resource + section this content was resolved from (the join target).
    resourceId: z.string().min(1), // canonical {kind}/{slug}
    sectionId: z.string().min(1),
    citations: z.array(ResourceCitationSchema).min(1),
    excerpt: z.string().min(1).nullable(),
  })
  .strict();

/**
 * `BriefBlock` (mid-level §1). `landingZoneId` is set on per-zone blocks ONLY
 * (P26): LZ-dependent blocks (availability, policy) render once per member zone;
 * LZ-independent blocks omit it and render once. `status` is the two-axis
 * resolution result (honest-empty per ADR-0013 §4: a missing block is `unresolved`
 * + a warning, NEVER an absent block; a failed fetch is `partial` + a warning,
 * NEVER silent truncation).
 */
export const BriefBlockSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    landingZoneId: z.string().min(1).optional(),
    // axis 1 — resolution status, reusing sectionStatuses (no parallel vocabulary).
    status: SectionStatusSchema,
    // Evidence vs pointers: separate arrays by construction (ADR-0003).
    evidence: z.array(BriefEvidenceSchema),
    pointers: z.array(OperationalLocationSchema),
    // axis 2 — reasons via warningCodes (ResourceWarning), never a status word.
    warnings: z.array(ResourceWarningSchema),
  })
  .strict();

/**
 * The situation the brief answers for: "for my app, in my landing zones, now".
 * `appId` is present only for a by-reference scope; `landingZoneIds` is the P26
 * SET the per-zone blocks fan out over (an LZ id carries its cloud identity — no
 * separate cloud dimension; plural from the first line, a hardcoded singular is a
 * defect).
 */
export const SituationSchema = z
  .object({
    appId: z.string().min(1).optional(),
    landingZoneIds: z.array(z.string().min(1)),
    origin: SituationOriginSchema,
  })
  .strict();

/**
 * The one serialized `Brief` value (I3). `resolvedAt` is the moment THIS brief
 * was assembled (ADR-0013 §3 — a resolution time, not a build time; the stable
 * `/briefs/{moment}.md` address restamps it every render, it is not a stored
 * file). No brief-level cache stamps it (M4): the content cache underneath is the
 * only cache, one clock (ADR-0013 §6).
 */
export const BriefSchema = z
  .object({
    moment: MomentSchema,
    situation: SituationSchema,
    blocks: z.array(BriefBlockSchema),
    resolvedAt: z.string().datetime(),
  })
  .strict();

export type Moment = z.infer<typeof MomentSchema>;
export type BriefDepth = z.infer<typeof BriefDepthSchema>;
export type SituationOrigin = z.infer<typeof SituationOriginSchema>;
export type OperationalLocationKind = z.infer<typeof OperationalLocationKindSchema>;
export type OperationalLocation = z.infer<typeof OperationalLocationSchema>;
export type BriefEvidence = z.infer<typeof BriefEvidenceSchema>;
export type BriefBlock = z.infer<typeof BriefBlockSchema>;
export type Situation = z.infer<typeof SituationSchema>;
export type Brief = z.infer<typeof BriefSchema>;

/* -------------------------------------------------------------------------- *
 * Step 7 — operational-location VALUE side + self-service REGISTRATION
 * (P24 aggregation-at-read, M12 auth modes/allowlist, M7 debug floor, M3
 * consumer state, ADR-0003 the pointer/value line).
 *
 * `OperationalLocation` (above) is the LANDED pointer shape — imported here,
 * NEVER re-declared. Step 7 adds two things on top of that single source:
 *   (a) the VALUE side — a value fetched THROUGH a pointer is uncited
 *       operational status (`LocationStatus.value`): never Evidence, never
 *       stored, visually separated (ADR-0003). There is deliberately NO
 *       citation field on a value.
 *   (b) self-service REGISTRATION — `{ system, kind, url }` consumer-state
 *       pointers (M3) with NO secret/token field: a token in a registration
 *       would be a secret store + an SSRF proxy at once (the rejected shape),
 *       so it is structural invalidity → 400.
 *
 * STEP 7 BATCH 0 STUBS: the hand-written types below are the frozen contract
 * (goal_prompt_step7_status_board.md, locked decisions 1-3); every schema value
 * throws `unimplemented` until later batches land the real zod shapes. Later:
 *   - Batch 1: `LocationRegistrationRequestSchema` / `LocationRecordSchema` /
 *     the response schemas become `.strict()`. The registration request is
 *     EXACTLY `{ system, kind, url }` — a `token`/`secret`/any unknown field is
 *     rejected (never a secret store); `kind` reuses `OperationalLocationKind`;
 *     `url` is a human link only (value fetch goes through the adapter base).
 *   - Batch 4: `LocationStatusSchema` / `StatusBoardResponseSchema` — `value` is
 *     the uncited at-read status, nullable (null ⇒ a labeled pointer + a
 *     `reason`); no citation field by construction (ADR-0003).
 * -------------------------------------------------------------------------- */

/**
 * POST /api/locations body. EXACTLY `{ system, kind, url }` — NO secret/token
 * field exists in this shape (locked decision 1). `id`/`appId`/`registeredAt`
 * are server-owned; the owning APP arrives from the request scope, not the body.
 */
export type LocationRegistrationRequest = {
  system: string;
  kind: OperationalLocationKind;
  url: string;
};

/**
 * A stored, self-registered operational-location pointer (M3 consumer state):
 * an `OperationalLocation` scoped to an APP, with server-set `id`/`registeredAt`.
 * `discoveredFrom` is the provenance label (`"registration"` for self-service).
 * Durable, labeled, never Evidence — mirrors `AppRecord`'s consumer-state posture.
 */
export type LocationRecord = {
  id: string;
  appId: string;
  system: string;
  kind: OperationalLocationKind;
  url: string;
  discoveredFrom: string;
  registeredAt: string;
};

/** POST/DELETE `/api/locations` body: the stored record + any dangling-declaration
 *  warnings (kept verbatim, warned, never dropped — the apps precedent). */
export type LocationRegistrationResponse = { location: LocationRecord; warnings: Warning[] };
/** GET `/api/locations?appId=` body. */
export type LocationListResponse = { locations: LocationRecord[] };

/**
 * Why a location renders as a labeled pointer instead of a live value
 * (locked decision 5): no adapter exists for the system, the adapter's authMode
 * is `none` (no value channel), or the value fetch failed. Closed set — a
 * degradation is always one of these honest reasons, never a fabricated value.
 */
export const locationStatusReasons = ["no-adapter", "no-value-channel", "fetch-failed"] as const;
export type LocationStatusReason = (typeof locationStatusReasons)[number];

/**
 * One status-board entry (P24 aggregation-at-read). `location` is the pointer
 * (its uncited existence). `value` is the LIVE operational status fetched through
 * the owning adapter's allowlisted base — uncited, never Evidence, never stored
 * (ADR-0003); `null` ⇒ a labeled pointer (the honest floor) carrying a `reason`.
 * `fetchedAt` is the read moment (null for a pointer). There is NO citation field:
 * a value is operational status, not Evidence.
 */
export type LocationStatusEntry = {
  location: OperationalLocation;
  value: string | null;
  reason?: LocationStatusReason;
  fetchedAt: string | null;
};

/**
 * GET `/api/status?appId=` body (fallback `landingZones`): the scope echo + the
 * read-only, uncited status list + governance warnings. No history, no alerting,
 * no durable store (P24) — the board is recomputed at read, every time.
 */
export type StatusBoardResponse = {
  situation: Situation;
  statuses: LocationStatusEntry[];
  warnings: Warning[];
};

/** Batch 0 stub: any parse throws until the real zod shape lands (later batches).
 *  `z.custom` preserves the inferred TYPE so the frozen stubs typecheck. */
function unimplementedLocationSchema<T>(name: string): z.ZodType<T> {
  return z.custom<T>(() => {
    throw new Error(
      `${name} is unimplemented (Step 7 Batch 1/4 — goal_prompt_step7_status_board.md)`,
    );
  });
}

export const LocationStatusReasonSchema = z.enum(locationStatusReasons);
export const LocationRegistrationRequestSchema: z.ZodType<LocationRegistrationRequest> =
  unimplementedLocationSchema("LocationRegistrationRequestSchema");
export const LocationRecordSchema: z.ZodType<LocationRecord> =
  unimplementedLocationSchema("LocationRecordSchema");
export const LocationRegistrationResponseSchema: z.ZodType<LocationRegistrationResponse> =
  unimplementedLocationSchema("LocationRegistrationResponseSchema");
export const LocationListResponseSchema: z.ZodType<LocationListResponse> =
  unimplementedLocationSchema("LocationListResponseSchema");
export const LocationStatusEntrySchema: z.ZodType<LocationStatusEntry> =
  unimplementedLocationSchema("LocationStatusEntrySchema");
export const StatusBoardResponseSchema: z.ZodType<StatusBoardResponse> =
  unimplementedLocationSchema("StatusBoardResponseSchema");

export {
  validateGuidanceDocument,
  validateGuidanceManifest,
  type GuidanceValidation,
  type ManifestIssue,
} from "./guidanceManifest";
