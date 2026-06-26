/**
 * Relocated availability fixture (plan 014) — the single dataset.
 *
 * This is the DEV-MOCK return of the one availability read (`readAvailability`):
 * a fictional, public-safe AWS + Azure grid of services × locations. Every
 * consumer (Portal Explore, the MCP `atlas_get_availability` tool, and the agent
 * resource `availability` section via the matrix resolver) now reads THIS one
 * dataset, so they can never diverge. In prod the same read live-fetches the
 * Confluence availability page at the boundary the matrix resolver already uses;
 * the bytes' authorship doesn't change the single-source guarantee.
 *
 * `toAvailabilityMatrixMarkdown` projects the governed region × Service matrix
 * (ADR-0009) out of this fixture so `availabilityMatrixResolver` keeps parsing
 * markdown — the matrix facts are no longer hand-authored a second time.
 */
import type {
  AvailabilityRecord,
  LandingZoneData,
  Location,
  LocationAvailability,
} from "@atlas/schema";

const av = (note?: string): LocationAvailability => ({ status: "available", note });
const pl = (eta: string): LocationAvailability => ({ status: "planned", note: eta });
const it = (note: string): LocationAvailability => ({ status: "interim", note });

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
  svc(
    "cloudfront",
    "CloudFront",
    "Networking",
    "CF",
    seededAvailability("cloudfront", AWS_LOCATIONS),
  ),
  svc("route53", "Route 53", "Networking", "R53", seededAvailability("route53", AWS_LOCATIONS)),
  svc(
    "api-gateway",
    "API Gateway",
    "App Integration",
    "APG",
    seededAvailability("api-gateway", AWS_LOCATIONS),
  ),
  svc(
    "cloudwatch",
    "CloudWatch",
    "Operations",
    "CW",
    seededAvailability("cloudwatch", AWS_LOCATIONS),
  ),
  svc("dynamodb", "DynamoDB", "Database", "DDB", seededAvailability("dynamodb", AWS_LOCATIONS)),
  svc(
    "rds",
    "Relational Database Service (RDS)",
    "Database",
    "RDS",
    seededAvailability("rds", AWS_LOCATIONS),
  ),
  svc(
    "documentdb",
    "DocumentDB",
    "Database",
    "DDB",
    seededAvailability("documentdb", AWS_LOCATIONS),
  ),
  svc("neptune", "Neptune", "Database", "NEP", seededAvailability("neptune", AWS_LOCATIONS)),
  svc(
    "opensearch",
    "OpenSearch Service",
    "Analytics",
    "OSS",
    seededAvailability("opensearch", AWS_LOCATIONS),
  ),
  svc("redshift", "Redshift", "Analytics", "RSH", seededAvailability("redshift", AWS_LOCATIONS)),
  svc("emr", "EMR", "Analytics", "EMR", seededAvailability("emr", AWS_LOCATIONS)),
  svc(
    "msk",
    "Managed Streaming for Apache Kafka",
    "Analytics",
    "MSK",
    seededAvailability("msk", AWS_LOCATIONS),
  ),
  svc("mq", "Amazon MQ", "App Integration", "MQ", seededAvailability("mq", AWS_LOCATIONS)),
  svc("cognito", "Cognito", "Security", "COG", seededAvailability("cognito", AWS_LOCATIONS)),
  svc("appsync", "AppSync", "App Integration", "APS", seededAvailability("appsync", AWS_LOCATIONS)),
  svc(
    "sagemaker",
    "SageMaker",
    "AI Services",
    "SM",
    seededAvailability("sagemaker", AWS_LOCATIONS),
  ),
  svc(
    "rekognition",
    "Rekognition",
    "AI Services",
    "REK",
    seededAvailability("rekognition", AWS_LOCATIONS),
  ),
  svc(
    "comprehend",
    "Comprehend",
    "AI Services",
    "CMP",
    seededAvailability("comprehend", AWS_LOCATIONS),
  ),
  svc(
    "translate",
    "Translate",
    "AI Services",
    "TRS",
    seededAvailability("translate", AWS_LOCATIONS),
  ),
  svc(
    "transcribe",
    "Transcribe",
    "AI Services",
    "TRC",
    seededAvailability("transcribe", AWS_LOCATIONS),
  ),
  svc("polly", "Polly", "AI Services", "POL", seededAvailability("polly", AWS_LOCATIONS)),
  svc(
    "connect",
    "Connect",
    "Customer Engagement",
    "CON",
    seededAvailability("connect", AWS_LOCATIONS),
  ),
  svc(
    "iam-identity-center",
    "IAM Identity Center",
    "Security",
    "IAM",
    seededAvailability("iam-identity-center", AWS_LOCATIONS),
  ),
  svc("kms", "Key Management Service", "Security", "KMS", seededAvailability("kms", AWS_LOCATIONS)),
  svc(
    "secrets-manager",
    "Secrets Manager",
    "Security",
    "SEC",
    seededAvailability("secrets-manager", AWS_LOCATIONS),
  ),
  svc(
    "cloudformation",
    "CloudFormation",
    "Operations",
    "CFN",
    seededAvailability("cloudformation", AWS_LOCATIONS),
  ),
  svc(
    "cloudtrail",
    "CloudTrail",
    "Operations",
    "CTR",
    seededAvailability("cloudtrail", AWS_LOCATIONS),
  ),
  svc("config", "Config", "Operations", "CFG", seededAvailability("config", AWS_LOCATIONS)),
  svc(
    "systems-manager",
    "Systems Manager",
    "Operations",
    "SSM",
    seededAvailability("systems-manager", AWS_LOCATIONS),
  ),
  svc("guardduty", "GuardDuty", "Security", "GDT", seededAvailability("guardduty", AWS_LOCATIONS)),
  svc(
    "security-hub",
    "Security Hub",
    "Security",
    "SH",
    seededAvailability("security-hub", AWS_LOCATIONS),
  ),
  svc("waf", "WAF", "Security", "WAF", seededAvailability("waf", AWS_LOCATIONS)),
  svc(
    "direct-connect",
    "Direct Connect",
    "Networking",
    "DCX",
    seededAvailability("direct-connect", AWS_LOCATIONS),
  ),
  svc(
    "privatelink",
    "PrivateLink",
    "Networking",
    "PL",
    seededAvailability("privatelink", AWS_LOCATIONS),
  ),
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

/** Deterministic hash so Azure data stays stable across requests. */
function seedHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededAvailability(
  serviceId: string,
  locations: ReadonlyArray<Location>,
): Record<string, LocationAvailability> {
  const result: Record<string, LocationAvailability> = {};
  const etas = ["06/30/2026", "08/15/2026", "09/01/2026", "Q4 2026", "TBD"];
  for (const loc of locations) {
    const n = seedHash(`${serviceId}:${loc.id}`) % 100;
    if (n < 50) result[loc.id] = av();
    else if (n < 70)
      result[loc.id] = pl(etas[seedHash(`${serviceId}:${loc.id}:eta`) % etas.length]!);
    else if (n < 82) result[loc.id] = it("preview");
    // else: not-planned (absent entry)
  }
  return result;
}

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
  svc(id, name, domain, iconKey, seededAvailability(id, AZURE_LOCATIONS)),
);

/* -------------------------------------------------------------------------- */
/*  Single dataset + governed-matrix projection                               */
/* -------------------------------------------------------------------------- */

/** The one availability grid every consumer reads (plan 014). */
export const availabilityZones: LandingZoneData[] = [
  { id: "aws", name: "AWS", locations: AWS_LOCATIONS, services: AWS_SERVICES },
  { id: "azure", name: "Azure", locations: AZURE_LOCATIONS, services: AZURE_SERVICES },
];

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
