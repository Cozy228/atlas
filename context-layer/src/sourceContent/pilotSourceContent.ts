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
  });
}
