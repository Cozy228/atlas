/**
 * Shared catalog presentation constants for the `/catalog` + home domain index.
 * Fictional, public-safe copy ported from the round-1 design exploration.
 */

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

export const ENTRY_DOT: Record<CatalogStatus, string> = {
  ga: "bg-success",
  planned: "bg-warning",
  none: "bg-muted-foreground/30",
};
