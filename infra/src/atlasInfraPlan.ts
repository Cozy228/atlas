export type EnvironmentName = "local" | "test" | "production-like";

export type EnvironmentConfig = {
  environment: EnvironmentName;
  region: string;
  source_system_secret_ref?: string;
  llm_secret_ref?: string;
};

export type ResourceType =
  | "dynamodb-table"
  | "lambda-function"
  | "api-gateway"
  | "secrets-manager-secret"
  | "iam-role"
  | "portal-hosting"
  | "cloudwatch-log-group"
  | "cloudwatch-metric";

export type InfraResource = {
  name: string;
  type: ResourceType;
};

export type AtlasInfraPlan = {
  environment: EnvironmentConfig;
  resources: InfraResource[];
  observability: {
    metrics: string[];
  };
};

export const forbiddenV1Services = [
  "sqs-queue",
  "step-functions-state-machine",
  "opensearch-domain",
  "kendra-index",
  "bedrock-knowledge-base",
] as const;

export function buildEnvironmentConfig(
  environment: EnvironmentName,
): EnvironmentConfig {
  if (environment === "production-like") {
    return {
      environment,
      region: "us-east-1",
      source_system_secret_ref: "/atlas/production-like/source-system",
      llm_secret_ref: "/atlas/production-like/llm-provider",
    };
  }

  return {
    environment,
    region: "us-east-1",
  };
}

export function buildAtlasInfraPlan(
  environment: EnvironmentConfig,
): AtlasInfraPlan {
  return {
    environment,
    resources: [
      { name: "atlas-registry", type: "dynamodb-table" },
      { name: "atlas-context-api", type: "lambda-function" },
      { name: "atlas-http-api", type: "api-gateway" },
      { name: "atlas-runtime-secrets", type: "secrets-manager-secret" },
      { name: "atlas-runtime-role", type: "iam-role" },
      { name: "atlas-portal-hosting", type: "portal-hosting" },
      { name: "atlas-context-api-logs", type: "cloudwatch-log-group" },
      { name: "atlas-context-quality-metrics", type: "cloudwatch-metric" },
    ],
    observability: {
      metrics: [
        "source_selection_count",
        "anchor_resolution_failure_count",
        "context_bundle_warning_count",
        "api_error_count",
      ],
    },
  };
}
