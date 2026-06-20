/**
 * shared catalog model for the
 * `/catalog` directions that render the full availability projection
 * (60 services × 12 domains) enriched by real topics. Fictional, public-safe
 * copy ported from the round-1 design exploration.
 */
import type { Topic } from "@atlas/schema";

import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { findAvailabilityServiceForTopic } from "@/lib/capability-service";

/** One-line blurbs keyed by service id; fallback derives from the domain. */
export const SERVICE_NOTES: Record<string, string> = {
  s3: "Object storage with versioning, lifecycle rules, and bucket policies.",
  efs: "Shared POSIX file systems that mount across instances and containers.",
  ebs: "Block volumes for EC2 with snapshots and encryption by default.",
  backup: "Centralised backup plans and vaults across platform services.",
  ec2: "Virtual machines on approved AMIs with hardened baseline images.",
  lambda: "Run functions without servers; the default for event-driven work.",
  "ecs-fargate": "Serverless containers; the platform-recommended runtime.",
  ecr: "Private container image registry with scan-on-push enabled.",
  eks: "Managed Kubernetes for teams that need the full control plane.",
  "ecs-ec2": "Container orchestration on self-managed EC2 capacity.",
  aurora: "Serverless PostgreSQL that scales to zero between workloads.",
  elasticache: "Managed Redis and Memcached for low-latency caching.",
  dynamodb: "Serverless key-value tables with single-digit-ms reads.",
  neptune: "Managed graph database for connected-data workloads.",
  kinesis: "Real-time data streaming ingestion at any scale.",
  glue: "Serverless ETL jobs and a shared data catalog.",
  athena: "Query data in object storage with standard SQL.",
  redshift: "Petabyte-scale warehousing for analytical workloads.",
  emr: "Managed Spark and Hadoop clusters for batch analytics.",
  sqs: "Queues that decouple producers from consumers.",
  sns: "Pub/sub fan-out to queues, functions, and endpoints.",
  eventbridge: "The platform event bus; route events between services.",
  airflow: "Managed Apache Airflow for scheduled data pipelines.",
  "step-functions": "Orchestrate multi-step workflows as state machines.",
  mq: "Managed ActiveMQ and RabbitMQ for protocol-level messaging.",
  transfer: "Managed SFTP/FTPS endpoints in front of object storage.",
  dms: "Replicate and migrate databases with minimal downtime.",
  bedrock: "Foundation models behind a single governed API.",
  agentcore: "Build and run governed AI agents on platform models.",
  textract: "Extract text, tables, and forms from documents.",
  comprehend: "Detect entities, sentiment, and PII in text.",
  rekognition: "Image and video analysis behind a governed API.",
  sagemaker: "Train, tune, and host custom ML models.",
  polly: "Convert text to lifelike speech.",
  transcribe: "Speech-to-text for calls, meetings, and media.",
  translate: "Neural machine translation between supported languages.",
  elb: "Managed L4/L7 load balancing with TLS termination.",
  route53: "Authoritative DNS zones and health-checked routing.",
  cloudfront: "CDN edge caching in front of approved origins.",
  "direct-connect": "Dedicated private links from on-prem to the platform.",
  privatelink: "Private service endpoints that never cross the internet.",
  "api-gateway": "Managed REST and WebSocket API front doors.",
  appsync: "Managed GraphQL APIs with real-time subscriptions.",
  msk: "Managed Apache Kafka for high-throughput streaming.",
  opensearch: "Search and log analytics clusters, managed.",
  rds: "Managed relational engines with automated patching.",
  documentdb: "Managed document database with MongoDB compatibility.",
  kms: "Centrally managed encryption keys and rotation.",
  cognito: "User pools and federated sign-in for applications.",
  guardduty: "Continuous threat detection across accounts.",
  waf: "Managed web application firewall rules at the edge.",
  "secrets-manager": "Store, rotate, and audit application secrets.",
  "security-hub": "Aggregated security findings and compliance scores.",
  "iam-identity-center": "Workforce SSO and permission-set management.",
  cloudwatch: "Metrics, logs, and alarms for platform workloads.",
  cloudtrail: "Immutable audit history of every API call.",
  cloudformation: "Declarative infrastructure stacks as code.",
  config: "Resource inventory with compliance rule evaluation.",
  "systems-manager": "Fleet patching, run commands, and parameters.",
  connect: "Cloud contact centre with governed telephony.",
};

/** Fictional owning teams per domain. */
export const DOMAIN_OWNERS: Record<string, string> = {
  Storage: "Storage Platform",
  Compute: "Compute Platform",
  Containers: "Container Platform",
  Database: "Data Platform",
  Analytics: "Data Platform",
  "App Integration": "Integration Services",
  "Migration & Transfer": "Migration Services",
  "AI Services": "AI Platform",
  Networking: "Network Engineering",
  Security: "Security Engineering",
  Operations: "Platform Operations",
  "Customer Engagement": "Workplace Services",
};

export const DOMAIN_BLURBS: Record<string, string> = {
  Storage: "Object, block, file, and backup primitives.",
  Compute: "Virtual machines and serverless functions.",
  Containers: "Registries and runtimes for containerised work.",
  Database: "Relational, key-value, cache, and graph stores.",
  Analytics: "Streaming, ETL, query, and warehousing.",
  "App Integration": "Queues, events, and workflow orchestration.",
  "Migration & Transfer": "Move data and workloads onto the platform.",
  "AI Services": "Governed model access and document AI.",
  Networking: "Load balancing, DNS, edge, and private connectivity.",
  Security: "Keys, identity, detection, and compliance posture.",
  Operations: "Observability, audit, and fleet management.",
  "Customer Engagement": "Contact-centre and engagement tooling.",
};

export type CatalogStatus = "ga" | "planned" | "none";

export type CatalogEntry = {
  id: string;
  name: string;
  domain: string;
  description: string;
  owner: string;
  channel: string;
  status: CatalogStatus;
  liveRegions: number;
  plannedRegions: number;
  topicId: string | null;
};

export type DomainShelf = {
  domain: string;
  anchor: string;
  blurb: string;
  items: ReadonlyArray<CatalogEntry>;
};

export function slugifyDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildEntries(
  services: ReadonlyArray<AvailabilityRecord>,
  locations: ReadonlyArray<Location>,
  topics: ReadonlyArray<Topic>,
): ReadonlyArray<CatalogEntry> {
  const capabilities = topics.filter((topic) => topic.topic_type === "capability");
  const topicByService = new Map<string, Topic>();
  for (const topic of capabilities) {
    const service = findAvailabilityServiceForTopic(topic, services);
    if (service) topicByService.set(service.id, topic);
  }
  return services.map((service) => {
    const topic = topicByService.get(service.id) ?? null;
    let live = 0;
    let planned = 0;
    for (const location of locations) {
      const status = service.availability[location.id]?.status;
      if (status === "available" || status === "interim") live += 1;
      else if (status === "planned") planned += 1;
    }
    const owner = topic?.owner_team ?? DOMAIN_OWNERS[service.domain] ?? "Platform Engineering";
    return {
      id: service.id,
      name: service.name,
      domain: service.domain,
      description:
        topic?.description ??
        SERVICE_NOTES[service.id] ??
        `${service.domain} service offered through the platform catalog.`,
      owner,
      channel: topic?.support_channel ?? `#${slugifyDomain(service.domain)}-support`,
      status: live > 0 ? "ga" : planned > 0 ? "planned" : "none",
      liveRegions: live,
      plannedRegions: planned,
      topicId: topic?.id ?? null,
    };
  });
}

/** Entries grouped into alphabetical domain shelves, with stable anchors. */
export function buildShelves(entries: ReadonlyArray<CatalogEntry>): ReadonlyArray<DomainShelf> {
  const byDomain = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const bucket = byDomain.get(entry.domain) ?? [];
    bucket.push(entry);
    byDomain.set(entry.domain, bucket);
  }
  return [...byDomain.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, items]) => ({
      domain,
      anchor: `domain-${slugifyDomain(domain)}`,
      blurb: DOMAIN_BLURBS[domain] ?? "",
      items: items.toSorted((a, b) => a.name.localeCompare(b.name)),
    }));
}

export const ENTRY_DOT: Record<CatalogStatus, string> = {
  ga: "bg-success",
  planned: "bg-warning",
  none: "bg-muted-foreground/30",
};

export function entryStatusText(entry: CatalogEntry): string {
  if (entry.status === "ga") {
    return `GA · ${entry.liveRegions} region${entry.liveRegions === 1 ? "" : "s"}`;
  }
  if (entry.status === "planned") return "Planned";
  return "Not offered";
}
