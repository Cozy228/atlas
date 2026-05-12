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

export type TerraformFile = {
  path: string;
  content: string;
};

export type AtlasInfraPlan = {
  environment: EnvironmentConfig;
  resources: InfraResource[];
  terraform_files: TerraformFile[];
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
    terraform_files: [
      {
        path: "main.tf",
        content: buildMainTerraform(environment),
      },
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

function buildMainTerraform(environment: EnvironmentConfig): string {
  const namePrefix = `atlas-${environment.environment}`;

  return `terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${environment.region}"
}

variable "context_api_package_path" {
  type    = string
  default = "build/context-api.zip"
}

resource "aws_dynamodb_table" "atlas_registry" {
  name         = "${namePrefix}-registry"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }
}

resource "aws_secretsmanager_secret" "atlas_runtime" {
  name = "${namePrefix}/runtime"
}

resource "aws_iam_role" "atlas_context_api" {
  name = "${namePrefix}-context-api"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "atlas_context_api" {
  name = "${namePrefix}-context-api"
  role = aws_iam_role.atlas_context_api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.atlas_registry.arn
      },
      {
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Effect   = "Allow"
        Resource = aws_secretsmanager_secret.atlas_runtime.arn
      },
      {
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "${"$"}{aws_cloudwatch_log_group.atlas_context_api.arn}:*"
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "atlas_context_api" {
  name              = "/aws/lambda/${namePrefix}-context-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "atlas_context_api" {
  function_name    = "${namePrefix}-context-api"
  filename         = var.context_api_package_path
  source_code_hash = filebase64sha256(var.context_api_package_path)
  role             = aws_iam_role.atlas_context_api.arn
  handler          = "handler.handler"
  runtime          = "nodejs22.x"

  environment {
    variables = {
      ATLAS_REGISTRY_TABLE = aws_dynamodb_table.atlas_registry.name
      ATLAS_RUNTIME_SECRET = aws_secretsmanager_secret.atlas_runtime.name
    }
  }
}

resource "aws_apigatewayv2_api" "atlas_http_api" {
  name          = "${namePrefix}-http-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "atlas_context_api" {
  api_id                 = aws_apigatewayv2_api.atlas_http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.atlas_context_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "context_bundle" {
  api_id    = aws_apigatewayv2_api.atlas_http_api.id
  route_key = "POST /context-bundle"
  target    = "integrations/${"$"}{aws_apigatewayv2_integration.atlas_context_api.id}"
}

resource "aws_lambda_permission" "allow_http_api" {
  statement_id  = "AllowExecutionFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.atlas_context_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${"$"}{aws_apigatewayv2_api.atlas_http_api.execution_arn}/*/*"
}

resource "aws_s3_bucket" "atlas_portal" {
  bucket = "${namePrefix}-portal"
}

resource "aws_cloudwatch_metric_alarm" "atlas_context_api_errors" {
  alarm_name          = "${namePrefix}-context-api-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0

  dimensions = {
    FunctionName = aws_lambda_function.atlas_context_api.function_name
  }
}
`;
}
