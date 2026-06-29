/**
 * Dev/integration guidance fixture (plan 018 G6) — the route-guidance manifests,
 * hosted in the MSW source-space (NOT a YAML file read off `data/`). These are the
 * snake_case manifests verbatim from the retired `data/guidance/*.yaml`, served as
 * a JSON array by the MSW guidance-store handler. The live `loadGuidance` loader
 * fetches this URL (`ATLAS_GUIDANCE_URL`), validates each against `@atlas/schema`'s
 * `GuidanceSchema`, and maps to the portal camelCase `Guidance` — exactly like
 * every other source (single live path, 018 G1). Prod points the same env at a
 * real guidance store; dev/tests point it here. Fictional and public-safe.
 */

/** Fictional guidance-store base the dev loader is pointed at. */
export const DEV_GUIDANCE_BASE_URL = "https://atlas-guidance-dev.example.com";

/** The guidance-store endpoint that returns the manifests as a JSON array. */
export const DEV_GUIDANCE_URL = `${DEV_GUIDANCE_BASE_URL}/guidance`;

/**
 * The route-guidance manifests (snake_case, schema shape). Authored in the
 * display-order contract the loader re-applies; cross-refs (`applies_to.services`
 * → resource slugs, `landing_zones` → LZ ids) are already keyed to the discovered
 * catalog. Copied verbatim from the retired `data/guidance/*.yaml` source.
 */
export const DEV_GUIDANCE_MANIFESTS: ReadonlyArray<Record<string, unknown>> = [
  {
    id: "new-app-onboarding",
    title: "New Application Onboarding",
    type: "route",
    scenario: "onboarding",
    family: "onboard",
    objective: "Help an application team onboard a new cloud workload to the standard platform.",
    destination: {
      title: "Application ready for standard cloud deployment",
      description: "The app has approved access, a provisioning path, and passes readiness checks.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.2.0",
    last_reviewed: "2026-04-18",
    applies_to: { services: ["aws/lambda"] },
    sources: ["platform-reference-guide"],
    steps: [
      {
        id: "choose-landing-zone",
        title: "Choose landing zone",
        kind: "decision",
        description:
          "Select the landing zone that matches this workload's data and compliance needs.",
        why: "The landing zone sets the guardrails, networking, and IAM boundary your app inherits.",
        tasks: [
          {
            id: "review-options",
            title: "Review landing zone options",
            action: { type: "atlas_page", label: "Open landing zones", target: "/catalog" },
          },
          { id: "confirm-choice", title: "Confirm the selected landing zone", required: true },
        ],
      },
      {
        id: "request-access",
        title: "Request access",
        kind: "action",
        description: "Open the approved access request path for the selected landing zone.",
        why: "Access must be granted through the approved request flow — Atlas does not submit it for you.",
        tasks: [
          {
            id: "open-request-form",
            title: "Open the access request form",
            required: true,
            action: {
              type: "external_link",
              label: "Open request form",
              target: "https://example.internal/access-request",
            },
          },
        ],
      },
      {
        id: "open-tfe",
        title: "Open Terraform Enterprise",
        kind: "action",
        description: "Use the approved TFE workspace or module to provision infrastructure.",
        why: "Provisioning runs through the approved infrastructure-as-code path, not the console.",
        tasks: [
          {
            id: "open-tfe-workspace",
            title: "Open the standard TFE workspace",
            required: true,
            action: {
              type: "tool_link",
              label: "Open TFE workspace",
              target: "https://example.internal/tfe/standard",
            },
          },
          {
            id: "copy-module",
            title: "Copy the module reference",
            action: {
              type: "copy_text",
              label: "Copy module ref",
              text: 'module "app" { source = "app.terraform.io/example/standard/aws" }',
            },
          },
        ],
        sources: ["lambda-module-readme"],
      },
      {
        id: "connect-harness",
        title: "Connect Harness pipeline",
        kind: "action",
        description: "Connect the standard deployment path for your service.",
        why: "Deployments are promoted through the approved Harness pipeline templates.",
        tasks: [
          {
            id: "open-harness",
            title: "Open the Harness setup guide",
            action: {
              type: "external_link",
              label: "Open Harness guide",
              target: "https://example.internal/harness/standard",
            },
          },
        ],
      },
      {
        id: "production-readiness",
        title: "Production readiness",
        kind: "checklist",
        description: "Confirm required checks before promoting the workload to production.",
        why: "Readiness is verified outside Atlas — this is the checklist, not a sign-off record.",
        tasks: [
          { id: "logging", title: "Logging and monitoring enabled", required: true },
          { id: "tags", title: "Required resource tags applied", required: true },
          { id: "iam", title: "IAM role pattern reviewed", required: true },
          { id: "support-owner", title: "Support owner confirmed", required: true },
        ],
        sources: ["logging-standard-doc", "iam-boundary-policy"],
      },
      {
        id: "done",
        title: "Onboarding complete",
        kind: "destination",
        description: "The application is ready for standard cloud deployment.",
      },
    ],
  },
  {
    id: "api-gateway-adoption",
    title: "Adopt API Gateway",
    type: "route",
    scenario: "service_enablement",
    family: "enable",
    objective:
      "Help an application team put API Gateway in front of their workload using the approved module.",
    destination: {
      title: "API Gateway fronting the application",
      description:
        "The app routes through a module-provisioned API Gateway with a private backend.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.0.0",
    last_reviewed: "2026-05-02",
    applies_to: { services: ["aws/api-gateway"], landing_zones: ["awsf"] },
    sources: ["apigateway-module-readme", "apigateway-integration-guide"],
    steps: [
      {
        id: "understand-fit",
        title: "Understand how it fits",
        kind: "action",
        description: "Review where API Gateway sits in your architecture before provisioning.",
        why: "API Gateway is your public edge — it fronts Lambda or a private VPC-link backend.",
        tasks: [
          {
            id: "open-datasheet",
            title: "Open the API Gateway datasheet",
            action: {
              type: "atlas_page",
              label: "Open API Gateway",
              target: "/catalog/api-gateway",
            },
          },
          {
            id: "review-integration",
            title: "Review the integration guide",
            action: {
              type: "external_link",
              label: "View integration guide",
              target: "https://confluence.example.com/display/CLOUD/API+Gateway+Integration",
            },
          },
        ],
        sources: ["apigateway-integration-guide"],
      },
      {
        id: "get-terraform",
        title: "Get the Terraform starter",
        kind: "action",
        description: "Use the approved module — copy the starter and pin it in your workspace.",
        why: "Provisioning runs through the approved module, not the console.",
        tasks: [
          {
            id: "open-module",
            title: "Open the API Gateway module",
            required: true,
            action: {
              type: "tool_link",
              label: "Open module",
              target:
                "https://tfe.example.com/app/example/registry/modules/private/example/apigateway/aws",
            },
          },
          {
            id: "copy-starter",
            title: "Copy the Terraform starter",
            action: {
              type: "copy_text",
              label: "Copy starter",
              text: [
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
              ].join("\n"),
            },
          },
        ],
        sources: ["apigateway-module-readme"],
      },
      {
        id: "wire-backend",
        title: "Wire your backend",
        kind: "action",
        description: "Point each route at your application function and keep the backend private.",
        why: "The module creates the integration and invoke permission from the route's lambda_arn.",
        tasks: [
          { id: "set-routes", title: "Map routes to your Lambda ARNs", required: true },
          {
            id: "private-backend",
            title: "Confirm the backend stays private (no public endpoint)",
            required: true,
          },
        ],
        sources: ["apigateway-module-readme"],
      },
      {
        id: "validate",
        title: "Validate before production",
        kind: "checklist",
        description: "Confirm edge controls before promoting the API.",
        why: "The gateway is the public entry point — throttling and logging are required.",
        tasks: [
          { id: "throttling", title: "Request throttling configured", required: true },
          { id: "access-logs", title: "Access logging enabled", required: true },
          { id: "authz", title: "Authorizer attached to protected routes", required: true },
        ],
        sources: ["apigateway-integration-guide"],
      },
      {
        id: "done",
        title: "API Gateway adopted",
        kind: "destination",
        description: "The application is fronted by a module-provisioned API Gateway.",
      },
    ],
  },
  {
    id: "s3-adoption",
    title: "Adopt Amazon S3",
    type: "route",
    scenario: "service_enablement",
    family: "enable",
    objective:
      "Help an application team provision an approved, guarded S3 bucket for its workload.",
    destination: {
      title: "Application backed by a guarded S3 bucket",
      description:
        "The app stores data in a module-provisioned bucket with encryption and no public access.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.0.0",
    last_reviewed: "2026-05-02",
    applies_to: { services: ["aws/s3"], landing_zones: ["awsf"] },
    sources: ["s3-module-readme", "s3-policy-doc"],
    steps: [
      {
        id: "understand-fit",
        title: "Understand how it fits",
        kind: "action",
        description: "Review the storage guardrails your bucket must satisfy.",
        why: "Buckets inherit the platform's public-access and encryption policy — design for it up front.",
        tasks: [
          {
            id: "open-datasheet",
            title: "Open the Amazon S3 datasheet",
            action: { type: "atlas_page", label: "Open Amazon S3", target: "/catalog/aws-s3" },
          },
          {
            id: "review-user-guide",
            title: "Review the S3 user guide",
            action: {
              type: "external_link",
              label: "View user guide",
              target: "https://confluence.example.com/display/CLOUD/S3+User+Guide",
            },
          },
        ],
        sources: ["s3-policy-doc"],
      },
      {
        id: "get-terraform",
        title: "Get the Terraform starter",
        kind: "action",
        description: "Use the approved module — copy the starter and pin it in your workspace.",
        why: "Provisioning runs through the approved module, not the console.",
        tasks: [
          {
            id: "open-module",
            title: "Open the S3 module",
            required: true,
            action: {
              type: "tool_link",
              label: "Open module",
              target: "https://github.com/acme/terraform-aws-s3",
            },
          },
          {
            id: "copy-starter",
            title: "Copy the Terraform starter",
            action: {
              type: "copy_text",
              label: "Copy starter",
              text: [
                'module "bucket" {',
                '  source              = "app.terraform.io/acme/s3/aws"',
                '  name                = "orders-assets"',
                "  versioning          = true",
                "  block_public_access = true",
                '  encryption          = "aws:kms"',
                "}",
              ].join("\n"),
            },
          },
        ],
        sources: ["s3-module-readme"],
      },
      {
        id: "validate",
        title: "Validate before production",
        kind: "checklist",
        description: "Confirm the bucket meets storage guardrails.",
        why: "Public exposure of buckets is a hard production blocker.",
        tasks: [
          { id: "no-public", title: "Block-public-access enabled", required: true },
          { id: "encryption", title: "Default encryption (KMS) enabled", required: true },
          { id: "versioning", title: "Versioning enabled for recoverability", required: true },
        ],
        sources: ["s3-policy-doc"],
      },
      {
        id: "done",
        title: "Amazon S3 adopted",
        kind: "destination",
        description: "The application stores data in a guarded, module-provisioned bucket.",
      },
    ],
  },
  {
    id: "textract-adoption",
    title: "Adopt AWS Textract",
    type: "route",
    scenario: "service_enablement",
    family: "enable",
    objective:
      "Help an application team call Textract from a private subnet using the approved module.",
    destination: {
      title: "Application calling Textract privately",
      description: "The app reaches Textract through a module-provisioned private endpoint.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.0.0",
    last_reviewed: "2026-05-02",
    applies_to: { services: ["aws/textract"], landing_zones: ["awsf"] },
    sources: ["textract-module-readme"],
    steps: [
      {
        id: "understand-fit",
        title: "Understand how it fits",
        kind: "action",
        description: "Review how Textract is reached from a private subnet.",
        why: "Document workloads reach Textract through a private interface endpoint, not the public internet.",
        tasks: [
          {
            id: "open-datasheet",
            title: "Open the AWS Textract datasheet",
            action: {
              type: "atlas_page",
              label: "Open AWS Textract",
              target: "/catalog/aws-textract",
            },
          },
          {
            id: "review-user-guide",
            title: "Review the Textract user guide",
            action: {
              type: "external_link",
              label: "View user guide",
              target: "https://confluence.example.com/display/CLOUD/Textract+User+Guide",
            },
          },
        ],
        sources: ["textract-module-readme"],
      },
      {
        id: "get-terraform",
        title: "Get the Terraform starter",
        kind: "action",
        description: "Use the approved module — copy the starter and pin it in your workspace.",
        why: "Provisioning runs through the approved module, not the console.",
        tasks: [
          {
            id: "open-module",
            title: "Open the Textract module",
            required: true,
            action: {
              type: "tool_link",
              label: "Open module",
              target: "https://github.com/acme/terraform-aws-textract",
            },
          },
          {
            id: "copy-starter",
            title: "Copy the Terraform starter",
            action: {
              type: "copy_text",
              label: "Copy starter",
              text: [
                'module "textract" {',
                '  source             = "app.terraform.io/acme/textract/aws"',
                '  name               = "doc-ocr"',
                '  endpoint_type      = "interface"',
                "  private_subnet_ids = var.private_subnet_ids",
                "}",
              ].join("\n"),
            },
          },
        ],
        sources: ["textract-module-readme"],
      },
      {
        id: "validate",
        title: "Validate before production",
        kind: "checklist",
        description: "Confirm private connectivity before promoting.",
        why: "Textract access must stay on the private path.",
        tasks: [
          {
            id: "private-endpoint",
            title: "Interface endpoint reachable from the subnet",
            required: true,
          },
          { id: "no-public", title: "No public egress path required", required: true },
        ],
        sources: ["textract-module-readme"],
      },
      {
        id: "done",
        title: "AWS Textract adopted",
        kind: "destination",
        description: "The application calls Textract through a private endpoint.",
      },
    ],
  },
];
