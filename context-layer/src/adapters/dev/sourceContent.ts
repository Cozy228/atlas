import { createInMemorySourceContentProvider } from "../../resolvers/sourceContentProvider";
import { toAvailabilityMatrixMarkdown } from "./availability";

export function createDevSourceContentProvider() {
  return createInMemorySourceContentProvider({
    "textract-module-readme": {
      "#private-subnet-usage":
        "Use the Textract module with private endpoint configuration for private subnet workloads.",
      "#terraform-starter":
        'module "textract" {\n  source             = "app.terraform.io/example/textract/aws"\n  name               = "doc-ocr"\n  endpoint_type      = "interface"\n  private_subnet_ids = var.private_subnet_ids\n}',
      // Registry-metadata field (ADR-0010) — distinct from the README prose above.
      "field:version": "1.4.0",
    },
    "bedrock-module-readme": {
      "#model-access": "Use approved Bedrock model access through the platform module.",
    },
    "lambda-module-readme": {
      "#event-sources": "Lambda workloads must declare event sources through module inputs.",
    },
    "s3-policy-doc": {
      "clause-2.1": "S3 buckets must block public access and enforce encryption.",
    },
    "legacy-s3-policy": {
      "clause-1.4": "Legacy S3 exceptions are deprecated and retained for migration only.",
    },
    "private-networking-policy": {},
    "iam-boundary-policy": {
      "clause-3.1": "Delegated roles must use the approved IAM permission boundary.",
    },
    "logging-standard-doc": {
      "clause-1.2": "Workloads must emit logs, metrics, and traces to platform telemetry.",
    },
    "apigateway-module-readme": {
      // The cited starter snippet — a registered Source excerpt, never synthesized.
      "#terraform-starter":
        'module "api" {\n  source     = "app.terraform.io/example/apigateway/aws"\n  name       = "orders-api"\n  protocol   = "HTTP"\n  stage_name = "prod"\n  routes = {\n    "POST /orders"     = { lambda_arn = module.orders_fn.arn }\n    "GET /orders/{id}" = { lambda_arn = module.orders_fn.arn }\n  }\n}',
      "#rest-api-setup":
        "Declare the HTTP API, routes, and stage through the module inputs; it provisions the API Gateway v2 API, default stage, and access logging.",
      "#lambda-integration":
        "Set each route's lambda_arn to your application function; the module creates the AWS_PROXY integration and the invoke permission so API Gateway fronts your app.",
    },
    "apigateway-integration-guide": {
      "apigateway-app-integration":
        "Put API Gateway at your application's edge: it terminates TLS, validates and throttles requests, then forwards to your Lambda or a private VPC-link target. Keep backends private and let the gateway be the only public entry point.",
    },
    "s3-module-readme": {
      "#terraform-starter":
        'module "bucket" {\n  source              = "app.terraform.io/example/s3/aws"\n  name                = "orders-assets"\n  versioning          = true\n  block_public_access = true\n  encryption          = "aws:kms"\n}',
      "#bucket-setup":
        "Declare the bucket through the module: it enforces block-public-access, default KMS encryption, and versioning, and emits the bucket name and ARN as outputs.",
    },
    // The governed region × Service availability table the matrix resolver parses
    // (ADR-0009). Projected out of the single availability dataset (plan 014) so
    // the matrix facts are never authored a second time; the grid is fictional.
    "availability-matrix": {
      "availability-matrix": toAvailabilityMatrixMarkdown(),
    },
  });
}
