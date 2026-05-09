/**
 * Availability projection for the Explore surface.
 *
 * The pilot Context Layer does not yet expose availability records; this
 * server function returns a hand-curated projection sourced from
 * `docs/architecture/catalog.md`. Swap the implementation for a Context API
 * call once availability becomes a first-class topic projection.
 */
import { createServerFn } from "@tanstack/react-start";

export type LocationKind = "region" | "outpost";

export type LocationStatus = "available" | "planned" | "interim" | "not-planned";

export type Location = {
  id: string;
  label: string;
  sub: string;
  kind: LocationKind;
};

export type LocationAvailability = {
  status: LocationStatus;
  /** ETA label for planned, interim caveat note for interim, etc. */
  note?: string;
};

export type AvailabilityRecord = {
  id: string;
  name: string;
  iconKey: string;
  domain: string;
  /** Map of location id -> availability. Missing entry means `not-planned`. */
  availability: Readonly<Record<string, LocationAvailability>>;
};

export type AvailabilityResponse = {
  locations: ReadonlyArray<Location>;
  services: ReadonlyArray<AvailabilityRecord>;
};

const LOCATIONS: ReadonlyArray<Location> = [
  { id: "us-east-1", label: "US-East-1", sub: "North Virginia", kind: "region" },
  {
    id: "ca-central-1",
    label: "CA-Central-1",
    sub: "Canada Central",
    kind: "region",
  },
  { id: "gdc", label: "GDC", sub: "Primary Outpost", kind: "outpost" },
  { id: "dc16", label: "DC16", sub: "DR Outpost", kind: "outpost" },
  { id: "mt10", label: "MT10", sub: "Future DR", kind: "outpost" },
];

const av = (note?: string): LocationAvailability => ({
  status: "available",
  note,
});
const pl = (eta: string): LocationAvailability => ({
  status: "planned",
  note: eta,
});

const SERVICES: ReadonlyArray<AvailabilityRecord> = [
  svc("landing-zones", "Landing Zones", "Landing Zones", "LZ", {
    "us-east-1": av("L3-L5"),
    "ca-central-1": av("L3-L5"),
  }),
  svc("s3", "S3", "Storage", "S3", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("efs", "Elastic File System (EFS)", "Storage", "EFS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ebs", "Elastic Block Storage (EBS)", "Storage", "EBS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("backup", "AWS Backup", "Storage", "BAK", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ec2", "EC2", "Compute", "EC2", {
    "us-east-1": av(),
    "ca-central-1": av(),
    gdc: pl("05/30/2026"),
    dc16: pl("07/31/2026"),
    mt10: pl("TBD"),
  }),
  svc("lambda", "Lambda", "Compute", "LAM", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ecs-fargate", "ECS Fargate", "Containers", "ECS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ecr", "Elastic Container Registry", "Containers", "ECR", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("eks", "Elastic Kubernetes Service (EKS)", "Containers", "EKS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ecs-ec2", "ECS on EC2", "Containers", "EC2", {
    gdc: pl("06/30/2026"),
    dc16: pl("07/31/2026"),
    mt10: pl("TBD"),
  }),
  svc("aurora", "Aurora Serverless v2 (PostgreSQL)", "Database", "PG", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("elasticache", "ElastiCache", "Database", "EC", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("kinesis", "Kinesis", "Analytics", "KIN", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("glue", "AWS Glue", "Analytics", "GLU", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("athena", "Athena", "Analytics", "ATH", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("sqs", "Simple Queue Service (SQS)", "App Integration", "SQS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("sns", "Simple Notification Service (SNS)", "App Integration", "SNS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("eventbridge", "EventBridge", "App Integration", "EVB", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("airflow", "Managed Apache Airflow", "App Integration", "MWA", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("step-functions", "Step Functions", "App Integration", "SFN", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("transfer", "Transfer Family", "Migration & Transfer", "TRN", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("dms", "Database Migration Service", "Migration & Transfer", "DMS", {
    "us-east-1": pl("05/30/2026"),
    "ca-central-1": pl("05/30/2026"),
  }),
  svc("bedrock", "Amazon Bedrock", "AI Services", "BDR", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("agentcore", "Bedrock AgentCore", "AI Services", "AGC", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("textract", "Amazon Textract", "AI Services", "TEX", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("elb", "Elastic Load Balancing (ELB)", "Networking", "ELB", {
    gdc: pl("06/30/2026"),
    dc16: pl("06/30/2026"),
    mt10: pl("TBD"),
  }),
];

function svc(
  id: string,
  name: string,
  domain: string,
  iconKey: string,
  availability: Record<string, LocationAvailability>,
): AvailabilityRecord {
  return { id, name, domain, iconKey, availability };
}

export const fetchAvailability = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(
  async (): Promise<AvailabilityResponse> => ({
    locations: LOCATIONS,
    services: SERVICES,
  }),
);
