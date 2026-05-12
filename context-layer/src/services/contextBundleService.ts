import type {
  Anchor,
  ContextBundleResponse,
  ContextRequest,
  Source,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  Topic,
  TopicDiscoveryRequest,
  TopicDiscoveryResponse,
} from "@atlas/schema";
import { DynamoFeedbackRepository } from "../repositories/dynamoFeedbackRepository.js";
import {
  InMemoryFeedbackRepository,
  type FeedbackRepository,
} from "../repositories/feedbackRepository.js";
import { loadPilotRegistry, pilotRegistrySeed, type PilotRegistry } from "../seeds/pilotRegistry.js";
import { confluencePageResolver } from "../resolvers/confluencePageResolver.js";
import { policyDocumentResolver } from "../resolvers/policyDocumentResolver.js";
import { createResolverRegistry, type ResolverRegistry } from "../resolvers/resolverRegistry.js";
import type { SourceContentProvider } from "../resolvers/sourceContentProvider.js";
import { terraformModuleResolver } from "../resolvers/terraformModuleResolver.js";
import { createPilotSourceContentProvider } from "../sourceContent/pilotSourceContent.js";

export type ContextBundleService = {
  registry: PilotRegistry;
  resolvers: ResolverRegistry;
  contentProvider: SourceContentProvider;
  now: Date;
};

export type ContextBundleServiceOptions = {
  env?: Record<string, string | undefined>;
  feedbackRepository?: FeedbackRepository;
};

export function createDefaultContextBundleService(
  options: ContextBundleServiceOptions = {},
): ContextBundleService {
  const feedbackRepository =
    options.feedbackRepository ??
    createFeedbackRepository(options.env ?? readProcessEnv());

  return {
    registry: loadPilotRegistry(pilotRegistrySeed, { feedback: feedbackRepository }),
    resolvers: createResolverRegistry([
      terraformModuleResolver,
      confluencePageResolver,
      policyDocumentResolver,
    ]),
    contentProvider: createPilotSourceContentProvider(),
    now: new Date(),
  };
}

export function createFeedbackRepository(
  env: Record<string, string | undefined>,
): FeedbackRepository {
  const tableName = env.ATLAS_FEEDBACK_TABLE;
  if (tableName) {
    return new DynamoFeedbackRepository({ tableName });
  }
  return new InMemoryFeedbackRepository(pilotRegistrySeed.feedback);
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

export function buildContextBundle(
  service: ContextBundleService,
  request: ContextRequest,
): ContextBundleResponse {
  const disclosureLevel = request.disclosure_level ?? 1;
  const selectedSources = selectSources(service, request);
  const sources =
    disclosureLevel >= 3
      ? expandRelatedSources(service, selectedSources)
      : selectedSources;

  if (sources.length === 0) {
    return {
      bundle_id: "bundle-empty",
      request,
      sources: [],
      anchor_references: [],
      warnings: [
        {
          code: "no_registered_source",
          message: "No registered source found for the request.",
        },
      ],
      expansion_paths: [],
    };
  }

  const bundleSources = [];
  const warnings: ContextBundleResponse["warnings"] = [];
  const selectedAnchors = sources.flatMap((source) =>
    service.registry.anchors.findBySourceId(source.id),
  );

  for (const source of sources) {
    const anchors = service.registry.anchors.findBySourceId(source.id);

    if (source.visibility === "restricted") {
      warnings.push({
        code: "restricted_source",
        message: "Source exists but has restricted visibility.",
        source_id: source.id,
      });
    }

    if (isStale(source, service.now)) {
      warnings.push({
        code: "stale_source",
        message: "Source is past its review frequency.",
        source_id: source.id,
      });
    }

    const excerpts = [];

    if (disclosureLevel > 0) {
      const resolver = service.resolvers.get(source.source_class);
      for (const anchorId of anchorIdsForDisclosure(
        anchors,
        request.anchor_id,
        disclosureLevel,
      )) {
        const resolved = resolver?.resolve({
          source,
          anchors,
          anchorId,
          contentProvider: service.contentProvider,
        });

        if (resolved) {
          warnings.push(...resolved.warnings);
          excerpts.push(...resolved.excerpts);
        }
      }
    }

    bundleSources.push({
      source,
      anchors,
      selection_rationale: buildSelectionRationale(source, request),
      excerpts,
    });
  }

  warnings.push(...authorityConflictWarnings(sources));

  return {
    bundle_id: `bundle-${request.topic_id ?? request.source_id ?? request.query ?? "query"}`,
    request,
    sources: bundleSources,
    anchor_references: buildAnchorReferences(selectedAnchors),
    warnings,
    expansion_paths: buildExpansionPaths(selectedAnchors, disclosureLevel),
  };
}

export function discoverSources(
  service: ContextBundleService,
  request: SourceDiscoveryRequest,
): SourceDiscoveryResponse {
  const sources = service.registry.sources.list().filter((source) => {
    if (request.source_class && source.source_class !== request.source_class) {
      return false;
    }
    if (request.topic_id) {
      return service.registry.mappings
        .findByTopicId(request.topic_id)
        .some((mapping) => mapping.source_id === source.id);
    }
    if (request.query) {
      return matchesText(source, request.query);
    }
    return true;
  });

  return { sources };
}

export function discoverTopics(
  service: ContextBundleService,
  request: TopicDiscoveryRequest,
): TopicDiscoveryResponse {
  const topics = service.registry.topics.list().filter((topic) => {
    if (request.topic_type && topic.topic_type !== request.topic_type) {
      return false;
    }
    if (request.category && topic.category !== request.category) {
      return false;
    }
    if (request.query) {
      return matchesTopic(topic, request.query);
    }
    return true;
  });

  return { topics };
}

function selectSources(
  service: ContextBundleService,
  request: ContextRequest,
): Source[] {
  if (request.source_id) {
    const source = service.registry.sources.getById(request.source_id);
    return source ? [source] : [];
  }

  if (request.topic_id) {
    return service.registry.mappings
      .findByTopicId(request.topic_id)
      .map((mapping) => service.registry.sources.getById(mapping.source_id))
      .filter((source): source is Source => Boolean(source));
  }

  const query = request.query;
  if (!query) {
    return [];
  }

  const topics = service.registry.topics
    .list()
    .filter((topic) => matchesTopic(topic, query));
  const topicSources = topics.flatMap((topic) =>
    service.registry.mappings
      .findByTopicId(topic.id)
      .map((mapping) => service.registry.sources.getById(mapping.source_id)),
  );

  return uniqueSources([
    ...topicSources.filter((source): source is Source => Boolean(source)),
    ...service.registry.sources.list().filter((source) => matchesText(source, query)),
  ]);
}

function expandRelatedSources(
  service: ContextBundleService,
  sources: Source[],
): Source[] {
  const sourceIds = new Set(sources.map((source) => source.id));
  const topicIds = new Set(
    sources.flatMap((source) =>
      service.registry.mappings
        .findBySourceId(source.id)
        .map((mapping) => mapping.topic_id),
    ),
  );
  const relatedSources = Array.from(topicIds).flatMap((topicId) =>
    service.registry.mappings
      .findByTopicId(topicId)
      .map((mapping) => service.registry.sources.getById(mapping.source_id))
      .filter(
        (source): source is Source =>
          source !== undefined && !sourceIds.has(source.id),
      ),
  );

  return uniqueSources([...sources, ...relatedSources]);
}

function uniqueSources(sources: Source[]): Source[] {
  return Array.from(new Map(sources.map((source) => [source.id, source])).values());
}

function matchesTopic(topic: Topic, query: string): boolean {
  const haystack = [
    topic.id,
    topic.name,
    topic.topic_type,
    topic.category,
    topic.description,
    topic.owner_team,
  ].join(" ");
  return normalizedTokens(query).some((token) => haystack.toLowerCase().includes(token));
}

function matchesText(source: Source, query: string): boolean {
  const haystack = [
    source.id,
    source.title,
    source.source_class,
    source.steward,
    source.authority_level,
    ...source.authority_scope,
  ].join(" ");
  return normalizedTokens(query).some((token) => haystack.toLowerCase().includes(token));
}

function normalizedTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length > 2);
}

function buildSelectionRationale(source: Source, request: ContextRequest): string {
  if (request.source_id) {
    return "Selected by explicit source request.";
  }
  if (request.topic_id) {
    return "Selected through explicit Source-Topic mapping.";
  }
  return `Selected through deterministic registry match for ${source.authority_level} source metadata.`;
}

function buildAnchorReferences(
  anchors: Anchor[],
): ContextBundleResponse["anchor_references"] {
  return anchors.map((anchor) => ({
    source_id: anchor.source_id,
    anchor_id: anchor.id,
    citation_label: anchor.citation_label,
    status: anchor.status,
  }));
}

function anchorIdsForDisclosure(
  anchors: Anchor[],
  requestedAnchorId: string | undefined,
  disclosureLevel: number,
): Array<string | undefined> {
  if (disclosureLevel >= 2) {
    const anchorIds = anchors.map((anchor) => anchor.id);
    return uniqueAnchorIds(
      requestedAnchorId ? [requestedAnchorId, ...anchorIds] : anchorIds,
    );
  }

  return [requestedAnchorId ?? anchors[0]?.id];
}

function uniqueAnchorIds(anchorIds: string[]): string[] {
  return Array.from(new Set(anchorIds));
}

function buildExpansionPaths(
  anchors: Anchor[],
  disclosureLevel: number,
): ContextBundleResponse["expansion_paths"] {
  if (disclosureLevel >= 3) {
    return [];
  }

  const nextDisclosureLevel = disclosureLevel + 1;
  return anchors.map((anchor) => ({
    source_id: anchor.source_id,
    anchor_id: anchor.id,
    disclosure_level: nextDisclosureLevel,
    label: anchor.citation_label,
  }));
}

function authorityConflictWarnings(
  sources: Source[],
): ContextBundleResponse["warnings"] {
  const warnings: ContextBundleResponse["warnings"] = [];
  const byScope = new Map<string, Set<string>>();

  for (const source of sources) {
    for (const scope of source.authority_scope) {
      const levels = byScope.get(scope) ?? new Set<string>();
      levels.add(source.authority_level);
      byScope.set(scope, levels);
    }
  }

  for (const [scope, levels] of byScope.entries()) {
    if (levels.size > 1) {
      warnings.push({
        code: "authority_conflict",
        message: `Multiple authority levels are registered for ${scope}.`,
      });
    }
  }

  return warnings;
}

function isStale(source: Source, now: Date): boolean {
  const days = Number(source.review_frequency.match(/^P(\d+)D$/)?.[1] ?? "0");
  if (days === 0) {
    return false;
  }
  const reviewedAt = new Date(source.last_reviewed_at).getTime();
  return reviewedAt + days * 24 * 60 * 60 * 1000 < now.getTime();
}
