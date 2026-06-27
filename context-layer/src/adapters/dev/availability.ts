/**
 * Dev availability dataset (plan 014) — the single dataset behind the one
 * availability read.
 *
 * A fictional, public-safe AWS + Azure grid of services × locations. Every
 * consumer (Portal Explore, the MCP `atlas_get_availability` tool, and the agent
 * resource `availability` section via the matrix resolver) reads THIS one
 * dataset, so they can never diverge. In prod the same read live-fetches the
 * Confluence availability page at the boundary the matrix resolver already uses;
 * the bytes' authorship doesn't change the single-source guarantee.
 *
 * Every cell is hand-authored: a service with no authored availability carries
 * an empty map (an honest gap), never a procedurally fabricated status.
 *
 * `toAvailabilityMatrixMarkdown` projects the governed region × Service matrix
 * (ADR-0009) out of this dataset so `availabilityMatrixResolver` keeps parsing
 * markdown — the matrix facts are not authored a second time.
 */
import type {
  AvailabilityRecord,
  LandingZoneData,
  Location,
  LocationAvailability,
} from "@atlas/schema";
import type { AvailabilityProvider } from "../../services/availabilityProvider";

const av = (note?: string): LocationAvailability => ({ status: "available", note });
const pl = (eta: string): LocationAvailability => ({ status: "planned", note: eta });

function svc(
  id: string,
  name: string,
  domain: string,
  iconKey: string,
  availability: Record<string, LocationAvailability>,
): AvailabilityRecord {
  return { id, name, domain, iconKey, availability };
}

/* -------------------------------------------------------------------------- */
/*  AWS zone                                                                  */
/* -------------------------------------------------------------------------- */

const AWS_LOCATIONS: Location[] = [
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

const AWS_SERVICES: AvailabilityRecord[] = [
  svc("landing-zones", "Landing Zones", "Landing Zones", "LZ", {
    "us-east-1": av("L3-L5"),
    "ca-central-1": av("L3-L5"),
  }),
  svc("s3", "S3", "Storage", "S3", { "us-east-1": av(), "ca-central-1": av() }),
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
  svc("lambda", "Lambda", "Compute", "LAM", { "us-east-1": av(), "ca-central-1": av() }),
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

/* -------------------------------------------------------------------------- */
/*  Azure zone                                                                */
/* -------------------------------------------------------------------------- */

const AZURE_LOCATIONS: Location[] = [
  { id: "eastus", label: "East US", sub: "Virginia", kind: "region", coordinates: [-79.0, 37.5] },
  {
    id: "westus2",
    label: "West US 2",
    sub: "Washington",
    kind: "region",
    coordinates: [-119.7, 47.2],
  },
  { id: "centralus", label: "Central US", sub: "Iowa", kind: "region", coordinates: [-93.6, 41.9] },
  {
    id: "northeurope",
    label: "North EU",
    sub: "Ireland",
    kind: "region",
    coordinates: [-6.3, 53.3],
  },
  {
    id: "westeurope",
    label: "West EU",
    sub: "Netherlands",
    kind: "region",
    coordinates: [4.9, 52.4],
  },
  {
    id: "southeastasia",
    label: "SE Asia",
    sub: "Singapore",
    kind: "region",
    coordinates: [103.8, 1.3],
  },
  {
    id: "eastasia",
    label: "East Asia",
    sub: "Hong Kong",
    kind: "region",
    coordinates: [114.2, 22.3],
  },
  {
    id: "australiaeast",
    label: "AU East",
    sub: "Sydney",
    kind: "region",
    coordinates: [151.2, -33.9],
  },
  {
    id: "canadacentral",
    label: "CA Central",
    sub: "Toronto",
    kind: "region",
    coordinates: [-79.4, 43.7],
  },
  { id: "uksouth", label: "UK South", sub: "London", kind: "region", coordinates: [-0.1, 51.5] },
];

const AZURE_SERVICE_DEFS: ReadonlyArray<
  [id: string, name: string, domain: string, iconKey: string]
> = [
  /* Compute */
  ["vm", "Virtual Machines", "Compute", "VM"],
  ["app-service", "App Service", "Compute", "AS"],
  ["functions", "Azure Functions", "Compute", "FN"],
  ["container-instances", "Container Instances", "Compute", "CI"],
  ["aks", "Azure Kubernetes Service", "Compute", "AKS"],
  ["batch", "Azure Batch", "Compute", "BAT"],
  /* Storage */
  ["blob-storage", "Blob Storage", "Storage", "BLB"],
  ["file-storage", "Azure Files", "Storage", "AFS"],
  ["disk-storage", "Managed Disks", "Storage", "DSK"],
  ["data-lake", "Data Lake Storage", "Storage", "DLS"],
  /* Database */
  ["azure-sql", "Azure SQL Database", "Database", "SQL"],
  ["cosmos-db", "Cosmos DB", "Database", "CDB"],
  ["pg-flexible", "PostgreSQL Flexible Server", "Database", "PG"],
  ["redis-cache", "Azure Cache for Redis", "Database", "RDS"],
  /* Networking */
  ["vnet", "Virtual Network", "Networking", "VN"],
  ["load-balancer", "Load Balancer", "Networking", "LB"],
  ["app-gateway", "Application Gateway", "Networking", "AG"],
  ["front-door", "Azure Front Door", "Networking", "FD"],
  /* Analytics */
  ["synapse", "Synapse Analytics", "Analytics", "SYN"],
  ["data-factory", "Data Factory", "Analytics", "ADF"],
  ["databricks", "Azure Databricks", "Analytics", "DBR"],
  ["stream-analytics", "Stream Analytics", "Analytics", "SA"],
  /* Integration */
  ["service-bus", "Service Bus", "Integration", "SB"],
  ["event-grid", "Event Grid", "Integration", "EG"],
  ["logic-apps", "Logic Apps", "Integration", "LA"],
  ["api-management", "API Management", "Integration", "APM"],
  /* AI / ML */
  ["azure-openai", "Azure OpenAI Service", "AI Services", "AOI"],
  ["cognitive-services", "Azure AI Services", "AI Services", "AIS"],
  /* Security */
  ["key-vault", "Key Vault", "Security", "KV"],
  ["sentinel", "Microsoft Sentinel", "Security", "STL"],
  ["vm-scale-sets", "Virtual Machine Scale Sets", "Compute", "VMSS"],
  ["container-registry", "Container Registry", "Containers", "ACR"],
  ["cdn", "CDN Profiles", "Networking", "CDN"],
  ["static-web-apps", "Static Web Apps", "Compute", "SWA"],
  ["signalr", "SignalR Service", "Integration", "SIG"],
  ["event-hubs", "Event Hubs", "Analytics", "EH"],
  ["log-analytics", "Log Analytics", "Operations", "LOG"],
  ["power-bi", "Power BI Embedded", "Analytics", "PBI"],
  ["application-insights", "Application Insights", "Operations", "AIN"],
  ["mysql-flexible", "MySQL Flexible Server", "Database", "MY"],
  ["database-migration", "Database Migration Service", "Migration & Transfer", "DMS"],
  ["entra-id", "Microsoft Entra ID", "Security", "EID"],
  ["managed-identities", "Managed Identities", "Security", "MID"],
  ["azure-devops", "Azure DevOps", "Developer Tools", "ADO"],
  ["automation", "Automation Accounts", "Operations", "AUT"],
  ["policy", "Azure Policy", "Operations", "POL"],
  ["advisor", "Advisor", "Operations", "ADV"],
  ["firewall", "Azure Firewall", "Networking", "FW"],
  ["bastion", "Bastion", "Networking", "BST"],
  ["private-link", "Private Link", "Networking", "PL"],
  ["dns-zones", "DNS Zones", "Networking", "DNS"],
  ["virtual-wan", "Virtual WAN", "Networking", "VWAN"],
  ["recovery-services", "Recovery Services Vaults", "Storage", "RSV"],
  ["defender-cloud", "Defender for Cloud", "Security", "DFC"],
  ["monitor", "Azure Monitor", "Operations", "MON"],
];

const AZURE_SERVICES: AvailabilityRecord[] = AZURE_SERVICE_DEFS.map(([id, name, domain, iconKey]) =>
  svc(id, name, domain, iconKey, {}),
);

/* -------------------------------------------------------------------------- */
/*  Single dataset + governed-matrix projection                               */
/* -------------------------------------------------------------------------- */

/** The one availability grid every consumer reads (plan 014). */
export const availabilityZones: LandingZoneData[] = [
  { id: "aws", name: "AWS", locations: AWS_LOCATIONS, services: AWS_SERVICES },
  { id: "azure", name: "Azure", locations: AZURE_LOCATIONS, services: AZURE_SERVICES },
];

/** Dev adapter: serves the in-memory grid as the seed-agnostic availability port. */
export function createDevAvailabilityProvider(): AvailabilityProvider {
  return { getZones: () => availabilityZones };
}

/**
 * The governed availability-matrix scope (ADR-0009): the AWS zone, region
 * columns only, restricted to the services the registered `availability-cell`
 * anchors pin (`data/anchors.yaml`). Labels mirror those anchor selectors so the
 * markdown the resolver parses still answers S3 / API Gateway / Textract — but
 * every cell's STATUS is now read from `availabilityZones`, not authored twice.
 */
const MATRIX_ZONE_ID = "aws";
const MATRIX_ROWS: ReadonlyArray<{ label: string; serviceId: string }> = [
  { label: "S3", serviceId: "s3" },
  { label: "API Gateway", serviceId: "api-gateway" },
  { label: "Textract", serviceId: "textract" },
];

/** Serialize the governed matrix out of the single dataset into the markdown
 *  table `availabilityMatrixResolver` parses. */
export function toAvailabilityMatrixMarkdown(): string {
  const zone = availabilityZones.find((z) => z.id === MATRIX_ZONE_ID)!;
  const regions = zone.locations.filter((location) => location.kind === "region");
  const byId = new Map(zone.services.map((service) => [service.id, service]));

  const header = `| Service | ${regions.map((region) => region.id).join(" | ")} |`;
  const separator = `| ${Array(regions.length + 1)
    .fill("---")
    .join(" | ")} |`;
  const rows = MATRIX_ROWS.map(({ label, serviceId }) => {
    const service = byId.get(serviceId);
    const cells = regions.map(
      (region) => service?.availability[region.id]?.status ?? "not-planned",
    );
    return `| ${label} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
}
