import { createInMemorySourceContentProvider } from "../resolvers/sourceContentProvider.js";

export function createPilotSourceContentProvider() {
  return createInMemorySourceContentProvider({
    "textract-module-readme": {
      "#private-subnet-usage":
        "Use the Textract module with private endpoint configuration for private subnet workloads.",
    },
    "bedrock-module-readme": {
      "#model-access": "Use approved Bedrock model access through the platform module.",
    },
    "lambda-module-readme": {
      "#event-sources": "Lambda workloads must declare event sources through module inputs.",
    },
    "central-lz-confluence": {
      "environment-matrix":
        "Central Landing Zone separates production and non-production accounts.",
    },
    "regulated-lz-confluence": {
      "regulated-controls": "Regulated workloads require restricted control review.",
    },
    "sandbox-lz-confluence": {
      "expiration-policy": "Sandbox accounts expire after the approved trial period.",
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
        'module "api" {\n  source     = "app.terraform.io/acme/apigateway/aws"\n  name       = "orders-api"\n  protocol   = "HTTP"\n  stage_name = "prod"\n  routes = {\n    "POST /orders"     = { lambda_arn = module.orders_fn.arn }\n    "GET /orders/{id}" = { lambda_arn = module.orders_fn.arn }\n  }\n}',
      "#rest-api-setup":
        "Declare the HTTP API, routes, and stage through the module inputs; it provisions the API Gateway v2 API, default stage, and access logging.",
      "#lambda-integration":
        "Set each route's lambda_arn to your application function; the module creates the AWS_PROXY integration and the invoke permission so API Gateway fronts your app.",
    },
    "apigateway-integration-guide": {
      "apigateway-app-integration":
        "Put API Gateway at your application's edge: it terminates TLS, validates and throttles requests, then forwards to your Lambda or a private VPC-link target. Keep backends private and let the gateway be the only public entry point.",
    },
  });
}
