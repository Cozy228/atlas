/**
 * Dev/integration availability fixture (plan 021 G3) — the `awsf` landing zone's
 * availability data, hosted in the MSW source-space (NOT an in-code provider
 * seed). It is rendered into a Confluence storage-HTML page that the live
 * `confluenceAvailabilityProvider` and the `availabilityMatrixResolver` fetch +
 * parse, exactly like every other source (single live path, 018 G1). This is the
 * per-LZ form of the retired `adapters/dev/availability.ts` fixture: the AWS grid
 * moved from an in-code constant to the mocked source system it is discovered
 * from. Fictional and public-safe — no real services, regions, or coordinates.
 */
import type { Location, LocationAvailability } from "@atlas/schema";

/** A service row as authored here (presentation + per-location status). Rendered
 *  into the page table and parsed back into an `AvailabilityRecord`. */
export type AvailabilityServiceFixture = {
  id: string;
  name: string;
  domain: string;
  iconKey: string;
  availability: Record<string, LocationAvailability>;
};

const av = (note?: string): LocationAvailability => ({ status: "available", note });
const pl = (eta: string): LocationAvailability => ({ status: "planned", note: eta });

function svc(
  id: string,
  name: string,
  domain: string,
  iconKey: string,
  availability: Record<string, LocationAvailability>,
): AvailabilityServiceFixture {
  return { id, name, domain, iconKey, availability };
}

/** The `awsf` landing zone's regions + outposts (geography, fictional). */
export const AWSF_LOCATIONS: Location[] = [
  {
    id: "us-east-1",
    label: "US-East-1",
    sub: "North Virginia",
    kind: "region",
    coordinates: [-78.0, 38.9],
  },
  {
    id: "ca-central-1",
    label: "CA-Central-1",
    sub: "Canada Central",
    kind: "region",
    coordinates: [-73.6, 45.5],
  },
  { id: "gdc", label: "GDC", sub: "Primary Outpost", kind: "outpost", coordinates: [-0.1, 51.5] },
  { id: "dc16", label: "DC16", sub: "DR Outpost", kind: "outpost", coordinates: [8.7, 50.1] },
  { id: "mt10", label: "MT10", sub: "Future DR", kind: "outpost", coordinates: [103.8, 1.3] },
];

/** The `awsf` landing zone's service availability grid (fictional). */
export const AWSF_SERVICES: AvailabilityServiceFixture[] = [
  svc("s3", "Amazon S3", "Storage", "S3", { "us-east-1": av(), "ca-central-1": av() }),
  svc("efs", "Elastic File System (EFS)", "Storage", "EFS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("ebs", "Elastic Block Storage (EBS)", "Storage", "EBS", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("backup", "AWS Backup", "Storage", "BAK", { "us-east-1": av(), "ca-central-1": av() }),
  svc("ec2", "EC2", "Compute", "EC2", {
    "us-east-1": av(),
    "ca-central-1": av(),
    gdc: pl("05/30/2026"),
    dc16: pl("07/31/2026"),
    mt10: pl("TBD"),
  }),
  svc("lambda", "AWS Lambda", "Compute", "LAM", { "us-east-1": av(), "ca-central-1": av() }),
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
  svc("elasticache", "ElastiCache", "Database", "EC", { "us-east-1": av(), "ca-central-1": av() }),
  svc("kinesis", "Kinesis", "Analytics", "KIN", { "us-east-1": av(), "ca-central-1": av() }),
  svc("glue", "AWS Glue", "Analytics", "GLU", { "us-east-1": av(), "ca-central-1": av() }),
  svc("athena", "Athena", "Analytics", "ATH", { "us-east-1": av(), "ca-central-1": av() }),
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
  svc("cloudfront", "CloudFront", "Networking", "CF", {}),
  svc("route53", "Route 53", "Networking", "R53", {}),
  svc("api-gateway", "API Gateway", "App Integration", "APG", {
    "us-east-1": av(),
    "ca-central-1": av(),
  }),
  svc("cloudwatch", "CloudWatch", "Operations", "CW", {}),
  svc("dynamodb", "DynamoDB", "Database", "DDB", {}),
  svc("rds", "Relational Database Service (RDS)", "Database", "RDS", {}),
  svc("documentdb", "DocumentDB", "Database", "DDB", {}),
  svc("neptune", "Neptune", "Database", "NEP", {}),
  svc("opensearch", "OpenSearch Service", "Analytics", "OSS", {}),
  svc("redshift", "Redshift", "Analytics", "RSH", {}),
  svc("emr", "EMR", "Analytics", "EMR", {}),
  svc("msk", "Managed Streaming for Apache Kafka", "Analytics", "MSK", {}),
  svc("mq", "Amazon MQ", "App Integration", "MQ", {}),
  svc("cognito", "Cognito", "Security", "COG", {}),
  svc("appsync", "AppSync", "App Integration", "APS", {}),
  svc("sagemaker", "SageMaker", "AI Services", "SM", {}),
  svc("rekognition", "Rekognition", "AI Services", "REK", {}),
  svc("comprehend", "Comprehend", "AI Services", "CMP", {}),
  svc("translate", "Translate", "AI Services", "TRS", {}),
  svc("transcribe", "Transcribe", "AI Services", "TRC", {}),
  svc("polly", "Polly", "AI Services", "POL", {}),
  svc("connect", "Connect", "Customer Engagement", "CON", {}),
  svc("iam-identity-center", "IAM Identity Center", "Security", "IAM", {}),
  svc("kms", "Key Management Service", "Security", "KMS", {}),
  svc("secrets-manager", "Secrets Manager", "Security", "SEC", {}),
  svc("cloudformation", "CloudFormation", "Operations", "CFN", {}),
  svc("cloudtrail", "CloudTrail", "Operations", "CTR", {}),
  svc("config", "Config", "Operations", "CFG", {}),
  svc("systems-manager", "Systems Manager", "Operations", "SSM", {}),
  svc("guardduty", "GuardDuty", "Security", "GDT", {}),
  svc("security-hub", "Security Hub", "Security", "SH", {}),
  svc("waf", "WAF", "Security", "WAF", {}),
  svc("direct-connect", "Direct Connect", "Networking", "DCX", {}),
  svc("privatelink", "PrivateLink", "Networking", "PL", {}),
];

/** The fictional Confluence page id the `awsf` availability page is served at. */
export const DEV_AVAILABILITY_PAGE_ID_AWSF = "200001";

const STATUS_SEP = " · ";

/** Encode a cell as `status` or `status · note` (empty when not-planned). */
function renderCell(entry: LocationAvailability | undefined): string {
  if (!entry) {
    return "";
  }
  return entry.note ? `${entry.status}${STATUS_SEP}${entry.note}` : entry.status;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function row(cells: string[]): string {
  return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
}

/**
 * Render the `awsf` availability data into Confluence storage HTML: a Locations
 * table (id/label/sub/kind/lon/lat) and a Service availability table (id/name/
 * domain/icon + one status column per location). The provider + matrix resolver
 * parse these back — render and parse are inverses, so the grid round-trips
 * losslessly through the MSW fetch.
 */
export function renderAvailabilityPageStorage(
  locations: Location[] = AWSF_LOCATIONS,
  services: AvailabilityServiceFixture[] = AWSF_SERVICES,
): string {
  const locationRows = locations
    .map((location) =>
      row([
        location.id,
        location.label,
        location.sub,
        location.kind,
        String(location.coordinates?.[0] ?? ""),
        String(location.coordinates?.[1] ?? ""),
      ]),
    )
    .join("");

  const serviceHeader = row(["id", "name", "domain", "icon", ...locations.map((l) => l.id)]);
  const serviceRows = services
    .map((service) =>
      row([
        service.id,
        service.name,
        service.domain,
        service.iconKey,
        ...locations.map((location) => renderCell(service.availability[location.id])),
      ]),
    )
    .join("");

  return [
    "<h1>AWS Foundation — Regional Availability</h1>",
    "<h2>Locations</h2>",
    `<table data-table="locations"><tbody>`,
    row(["id", "label", "sub", "kind", "lon", "lat"]),
    locationRows,
    "</tbody></table>",
    "<h2>Service availability</h2>",
    `<table data-table="services"><tbody>`,
    serviceHeader,
    serviceRows,
    "</tbody></table>",
  ].join("\n");
}
