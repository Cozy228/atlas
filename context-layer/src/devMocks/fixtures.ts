/**
 * Dev/integration MSW fixtures — fictional source-system responses.
 *
 * These stand in for the real Confluence / Terraform / GitHub responses the live
 * adapters fetch. They are the *dev backing* for discovery: MSW serves them at the
 * network layer so the live adapters run unchanged (single live path), and prod
 * never imports this module. Everything here is fictional and public-safe — no real
 * space keys, page ids, module sources, or credentials.
 *
 * Lane H extends this per source system (Confluence content / availability /
 * What's New, Terraform README, GitHub guidance, CQL references). G0 seeds the
 * Confluence v2 page read that proves the MSW seam.
 */
import {
  DEV_AVAILABILITY_PAGE_ID_AWSF,
  renderAvailabilityPageStorage,
} from "./availabilityFixture";

/** Fictional Confluence site base (without `/wiki`) the dev adapter is pointed at. */
export const DEV_CONFLUENCE_BASE_URL = "https://atlas-dev.example.atlassian.net";

/** Fictional Confluence space keys the dev reference-discovery scope crawls. */
export const DEV_CONFLUENCE_SPACE_KEYS = ["CLOUD"];

/**
 * Fictional page id of the federated-platform "What's New" Confluence page. The
 * dev runtime points `ATLAS_RELEASE_NOTES_PAGE_ID` here so `resolveReleaseNotes`
 * fetches it through the same v2 channel as every other page and extracts both
 * formal releases AND standalone announcements from the one page (plan 018 G6).
 */
export const DEV_RELEASE_NOTES_PAGE_ID = "900001";

/**
 * Confluence CQL search corpus — candidate pages the `GET /wiki/rest/api/content/search`
 * handler recalls by fuzzy `title ~` match. The live reference-discovery adapter then
 * applies its own double-hit admission (identity token-sequence + doc-type pattern), so
 * this corpus deliberately includes NOISE pages (recalled but not admitted) to exercise
 * that filter. Titles carry a service token + a doc-type keyword so admission re-derives
 * the same `doc_type` the retired in-code fixture hard-coded. Fictional, public-safe.
 */
export type CqlCandidate = { title: string; webui: string };

export const CQL_REFERENCE_CORPUS: CqlCandidate[] = [
  // aws/textract — design + user-guide + policy, plus one noise page.
  {
    title: "Textract — service design",
    webui: "/wiki/spaces/CLOUD/pages/1201/Textract+Service+Design",
  },
  {
    title: "Textract — onboarding & usage guide",
    webui: "/wiki/spaces/CLOUD/pages/1202/Textract+Usage+Guide",
  },
  {
    title: "Textract — data handling policy",
    webui: "/wiki/spaces/CLOUD/pages/1203/Textract+Data+Policy",
  },
  {
    title: "Textract — sprint meeting notes",
    webui: "/wiki/spaces/CLOUD/pages/1209/Textract+Notes",
  }, // noise: no doc-type
  // aws/s3 — design + policy.
  { title: "S3 — bucket design", webui: "/wiki/spaces/CLOUD/pages/1301/S3+Bucket+Design" },
  {
    title: "S3 — public access policy",
    webui: "/wiki/spaces/CLOUD/pages/1302/S3+Public+Access+Policy",
  },
  // azure/aks — user-guide only (spine-only service path). Title carries the product
  // name (not the bare "AKS" slug) so it clears the identity-admission gate (B8/B9).
  {
    title: "Azure Kubernetes Service — onboarding guide",
    webui: "/wiki/spaces/CLOUD/pages/1401/AKS+Onboarding+Guide",
  },
  // aws/cloudwatch — user-guide only (a spine-only AWS service: in the `awsf`
  // availability grid, no resources.yaml overlay). Title carries the product name
  // so it clears the identity-admission gate (B8/B9).
  {
    title: "Amazon CloudWatch — operations & usage guide",
    webui: "/wiki/spaces/CLOUD/pages/1501/CloudWatch+Operations+Guide",
  },
];

/** Confluence Cloud REST v2 page payload shape the live content provider parses. */
export type ConfluencePageFixture = {
  id: string;
  title: string;
  version: { number: number; createdAt?: string };
  body: { storage: { value: string } };
  _links: { webui: string };
};

/**
 * Confluence v2 pages keyed by page id, served at
 * `${DEV_CONFLUENCE_BASE_URL}/wiki/api/v2/pages/:id?body-format=storage`.
 * Storage-format HTML uses real headings so the runtime heading-slug scan
 * (anchor "3 去") locates sections without pre-stored anchors.
 */
export const CONFLUENCE_PAGES: Record<string, ConfluencePageFixture> = {
  "100001": {
    id: "100001",
    title: "Managed Compute — Service Guide",
    version: { number: 7, createdAt: "2026-05-12T09:00:00.000Z" },
    body: {
      storage: {
        value: [
          "<h1>Managed Compute</h1>",
          "<p>Run event-driven functions without provisioning servers.</p>",
          "<h2>Network</h2>",
          "<p>Functions attach to a managed VPC connector for private egress.</p>",
          "<h2>Examples</h2>",
          "<p>Deploy with the published module and a handler entry point.</p>",
        ].join("\n"),
      },
    },
    _links: { webui: "/spaces/COMPUTE/pages/100001/Managed+Compute" },
  },
  // Governance policy pages (plan 018 G4): policy sources now resolve single-live
  // through Confluence, so each policy page carries the heading the binding
  // references; the runtime heading-slug scan locates the section.
  "300001": {
    id: "300001",
    title: "S3 Security Policy",
    version: { number: 4, createdAt: "2026-04-01T09:00:00.000Z" },
    body: {
      storage: {
        value: [
          "<h1>S3 Security Policy</h1>",
          "<h2>Public access controls</h2>",
          "<p>S3 buckets must block public access and enforce encryption.</p>",
        ].join("\n"),
      },
    },
    _links: { webui: "/spaces/CLOUD/pages/300001/S3+Security+Policy" },
  },
  "300002": {
    id: "300002",
    title: "Legacy S3 Policy",
    version: { number: 2, createdAt: "2024-01-15T09:00:00.000Z" },
    body: {
      storage: {
        value: [
          "<h1>Legacy S3 Policy</h1>",
          "<h2>Legacy public access</h2>",
          "<p>Legacy S3 exceptions are deprecated and retained for migration only.</p>",
        ].join("\n"),
      },
    },
    _links: { webui: "/spaces/CLOUD/pages/300002/Legacy+S3+Policy" },
  },
  [DEV_RELEASE_NOTES_PAGE_ID]: {
    id: DEV_RELEASE_NOTES_PAGE_ID,
    title: "What's New — Federated Platform",
    version: { number: 23, createdAt: "2026-06-11T08:00:00.000Z" },
    body: {
      storage: {
        // One page, two entry kinds: formal `Release Notes` sections (parsed into
        // releases) and a standalone `Announcements` section (parsed into editorial
        // notes). Mirrors the real page's shape so the live parser runs unchanged:
        // numbered scope items with bracketed JIRA-style tickets, a `CHG…` change
        // request, a "posted … on <day> <Month>, <year>" date; announcements are
        // "<Kind> — <Title>" headings with a summary, a "Posted on …" line, and an
        // anchor call-to-action (the renderer preserves the href). All fictional.
        value: [
          "<h1>What's New</h1>",
          "<p>Highlights from the federated platform — releases land roughly twice a month, with standalone announcements below.</p>",

          "<h2>Release Notes</h2>",
          "<p>Release Scope:</p>",
          "<p>Non-Compute:</p>",
          "<ol>",
          "<li>SCP: Enable Object Storage lifecycle tiering in all OUs [PLAT-201]</li>",
          "<li>Config: Tighten the default bucket encryption baseline [PLAT-202]</li>",
          "<li>Update OPA policy for the DATA_CLASS tag [PLAT-203]</li>",
          "</ol>",
          "<p>Compute:</p>",
          "<ol>",
          "<li>Managed Compute autoscaling capacity rebalancing [PLAT-204]</li>",
          "<li>EC2 patch-compliance report Lambda production deployment [PLAT-205]</li>",
          "</ol>",
          "<p>For this release change CHG0010001 | Change Request | Service Management - Production</p>",
          "<p>On Viva Engage: Conversation posted in the Cloud Platform community on 9th June, 2026.</p>",
          "<p>Additional details:</p>",

          "<h2>Release Notes</h2>",
          "<p>Release Scope:</p>",
          "<p>Non-Compute:</p>",
          "<ol>",
          "<li>Config: S3 access-log retention baseline [PLAT-210]</li>",
          "<li>SCP: Enable Step Functions in the Federated LZ [PLAT-211]</li>",
          "</ol>",
          "<p>Compute:</p>",
          "<ol>",
          "<li>EC2 AMI hardening pipeline rollout [PLAT-212]</li>",
          "</ol>",
          "<p>For this release change CHG0010002 | Change Request | Service Management - Production</p>",
          "<p>On Viva Engage: Conversation posted in the Cloud Platform community on 23rd June, 2026.</p>",
          "<p>Additional details:</p>",

          "<h2>Announcements</h2>",
          "<h3>New — Object Storage lifecycle tiering is generally available</h3>",
          "<p>Buckets can now tier cold objects to archive storage on a per-prefix schedule, with restore SLAs surfaced in the catalog entry.</p>",
          "<p>Posted on 11th June, 2026.</p>",
          '<p><a href="/catalog">View in catalog</a></p>',
          "<h3>Policy — WebAuthn step-up now required for admin scopes</h3>",
          "<p>Identity Gateway 4.18 enforces a hardware step-up before any admin-scoped token is issued. Service accounts are exempt until 1st July.</p>",
          "<p>Posted on 7th June, 2026.</p>",
          '<p><a href="/sources">Read the policy</a></p>',
          "<h3>Deprecated — Legacy webhook signing v1 enters its deprecation window</h3>",
          "<p>v1 HMAC signatures stop being accepted on 1st September. The migration guide covers rotating to v2 signing keys without dropping events.</p>",
          "<p>Posted on 5th June, 2026.</p>",
          '<p><a href="/guidance">Connect a pipeline</a></p>',
        ].join("\n"),
      },
    },
    _links: { webui: "/spaces/CLOUD/pages/900001/Whats+New" },
  },
  // Per-LZ availability page (plan 021 G3): the `awsf` landing zone's regional
  // availability grid, rendered from the relocated availability fixture. The live
  // `confluenceAvailabilityProvider` and the `availabilityMatrixResolver` both
  // fetch + parse THIS page — the per-LZ form of plan 018's availability handler.
  [DEV_AVAILABILITY_PAGE_ID_AWSF]: {
    id: DEV_AVAILABILITY_PAGE_ID_AWSF,
    title: "AWS Foundation — Regional Availability",
    version: { number: 5, createdAt: "2026-05-05T09:00:00.000Z" },
    body: { storage: { value: renderAvailabilityPageStorage() } },
    _links: { webui: "/spaces/CLOUD/pages/200001/AWS+Foundation+Availability" },
  },
};

/**
 * Fictional private Terraform Enterprise (TFE) host the dev adapter is pointed at
 * via `ATLAS_TERRAFORM_BASE_URL`. A non-public-registry base selects the TFE
 * `/api/registry/v1/modules` API path (the public `registry.terraform.io` would
 * select `/v1/modules`). Public-safe — no real registry host or token.
 */
export const DEV_TERRAFORM_BASE_URL = "https://tfe-dev.example.com";

/** Terraform registry module-version payload the live content provider parses. */
export type TerraformModuleVariable = { name?: string; default?: string; description?: string };
export type TerraformModuleFixture = {
  version: string;
  root: {
    readme: string;
    inputs?: TerraformModuleVariable[];
    outputs?: TerraformModuleVariable[];
  };
};

/**
 * Terraform modules keyed by registry address (`<namespace>/<name>/<provider>`),
 * served at `${DEV_TERRAFORM_BASE_URL}/api/registry/v1/modules/:namespace/:name/:provider`.
 * READMEs use real markdown headings so the runtime heading-slug scan locates a
 * section by locator (a heading's slug equals the locator without `#`, e.g.
 * `## Private subnet usage` → `private-subnet-usage`). Section wording mirrors the
 * retired in-memory dev fixture so content assertions hold; `version` backs the
 * `module-field` anchors (ADR-0010). Fictional, public-safe.
 */
export const TERRAFORM_MODULES: Record<string, TerraformModuleFixture> = {
  "example/textract/aws": {
    version: "1.4.0",
    root: {
      readme: [
        "# Textract Module",
        "## Private subnet usage",
        "Use the Textract module with private endpoint configuration for private subnet workloads.",
        "## Terraform starter",
        "```hcl",
        'module "textract" {',
        '  source             = "app.terraform.io/example/textract/aws"',
        '  name               = "doc-ocr"',
        '  endpoint_type      = "interface"',
        "  private_subnet_ids = var.private_subnet_ids",
        "}",
        "```",
      ].join("\n"),
    },
  },
  "example/bedrock/aws": {
    version: "1.0.0",
    root: {
      readme: [
        "# Bedrock Module",
        "## Model access",
        "Use approved Bedrock model access through the platform module.",
      ].join("\n"),
    },
  },
  "example/lambda/aws": {
    version: "1.0.0",
    root: {
      readme: [
        "# Lambda Module",
        "## Event sources",
        "Lambda workloads must declare event sources through module inputs.",
      ].join("\n"),
    },
  },
  "example/apigateway/aws": {
    version: "1.0.0",
    root: {
      readme: [
        "# API Gateway Module",
        "## Terraform starter",
        "```hcl",
        'module "api" {',
        '  source     = "app.terraform.io/example/apigateway/aws"',
        '  name       = "orders-api"',
        '  protocol   = "HTTP"',
        '  stage_name = "prod"',
        "  routes = {",
        '    "POST /orders"     = { lambda_arn = module.orders_fn.arn }',
        '    "GET /orders/{id}" = { lambda_arn = module.orders_fn.arn }',
        "  }",
        "}",
        "```",
        "## REST API setup",
        "Declare the HTTP API, routes, and stage through the module inputs; it provisions the API Gateway v2 API, default stage, and access logging.",
        "## Lambda integration",
        "Set each route's lambda_arn to your application function; the module creates the AWS_PROXY integration and the invoke permission so API Gateway fronts your app.",
      ].join("\n"),
    },
  },
  "example/s3/aws": {
    version: "1.0.0",
    root: {
      readme: [
        "# S3 Module",
        "## Terraform starter",
        "```hcl",
        'module "bucket" {',
        '  source              = "app.terraform.io/example/s3/aws"',
        '  name                = "orders-assets"',
        "  versioning          = true",
        "  block_public_access = true",
        '  encryption          = "aws:kms"',
        "}",
        "```",
        "## Bucket setup",
        "Declare the bucket through the module: it enforces block-public-access, default KMS encryption, and versioning, and emits the bucket name and ARN as outputs.",
      ].join("\n"),
    },
  },
};
