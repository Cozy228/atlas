import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const infraRoot = new URL("..", import.meta.url).pathname;

function readTerraformFile(name: string): string {
  return readFileSync(join(infraRoot, name), "utf8");
}

describe("Atlas Terraform deployment", () => {
  const mainTerraform = readTerraformFile("main.tf");
  const variablesTerraform = readTerraformFile("variables.tf");
  const combinedTerraform = `${mainTerraform}\n${variablesTerraform}`;

  it("defines the ALB, ECS Fargate service, and DynamoDB feedback table", () => {
    expect(mainTerraform).toContain('resource "aws_lb" "portal"');
    expect(mainTerraform).toContain('resource "aws_lb_target_group" "portal"');
    expect(mainTerraform).toContain('resource "aws_ecs_cluster" "atlas"');
    expect(mainTerraform).toContain('resource "aws_ecs_task_definition" "portal"');
    expect(mainTerraform).toContain('resource "aws_ecs_service" "portal"');
    expect(mainTerraform).toContain('requires_compatibilities = ["FARGATE"]');
    expect(mainTerraform).toContain('resource "aws_dynamodb_table" "feedback"');
  });

  it("keeps Lambda Web Adapter, Lambda, and API Gateway out of the deployment", () => {
    expect(combinedTerraform).not.toContain("aws_lambda_function");
    expect(combinedTerraform).not.toContain("aws_apigatewayv2_api");
    expect(combinedTerraform).not.toContain("lambda-adapter");
    expect(combinedTerraform).not.toContain("aws-lambda-adapter");
    expect(combinedTerraform).not.toContain("AWS_LWA");
  });

  it("matches the feedback repository DynamoDB contract", () => {
    expect(mainTerraform).toContain('hash_key     = "pk"');
    expect(mainTerraform).toContain('range_key    = "sk"');
    expect(mainTerraform).toContain('name            = "gsi1"');
    expect(mainTerraform).toContain('hash_key        = "gsi1pk"');
    expect(mainTerraform).toContain('range_key       = "gsi1sk"');
    expect(mainTerraform).toContain(
      '{ name = "FEEDBACK_TABLE", value = aws_dynamodb_table.feedback.name }',
    );
  });

  it("makes the source-cache freshness policy explicit in ECS", () => {
    expect(mainTerraform).toContain('{ name = "CACHE_TTL_SECONDS", value = "300" }');
    expect(mainTerraform).toContain('{ name = "CACHE_NEGATIVE_TTL_SECONDS", value = "30" }');
    expect(mainTerraform).toContain('{ name = "CACHE_VALIDATION_TTL_SECONDS", value = "300" }');
    expect(mainTerraform).toContain('{ name = "CACHE_CONTENT_TTL_SECONDS", value = "604800" }');
    expect(mainTerraform).toContain(
      '{ name = "CACHE_VALKEY_URL", value = "rediss://${aws_elasticache_replication_group.content_cache.configuration_endpoint_address}:6379" }',
    );
  });

  it("wires optional standard proxy variables into the portal task", () => {
    expect(mainTerraform).toContain(
      'var.http_proxy != "" ? [{ name = "HTTP_PROXY", value = var.http_proxy }] : []',
    );
    expect(mainTerraform).toContain(
      'var.https_proxy != "" ? [{ name = "HTTPS_PROXY", value = var.https_proxy }] : []',
    );
    expect(mainTerraform).toContain(
      'var.no_proxy != "" ? [{ name = "NO_PROXY", value = var.no_proxy }] : []',
    );
    expect(variablesTerraform).toContain('variable "http_proxy"');
    expect(variablesTerraform).toContain('variable "https_proxy"');
    expect(variablesTerraform).toContain('variable "no_proxy"');
  });

  it("aligns ALB and ECS lifecycle with the Hono runtime", () => {
    expect(mainTerraform).toContain('path                = "/health"');
    expect(mainTerraform).toContain("deregistration_delay = 30");
    expect(mainTerraform).toContain("stopTimeout = 30");
    expect(mainTerraform).toContain('operating_system_family = "LINUX"');
    expect(mainTerraform).toContain('cpu_architecture        = "X86_64"');
  });
});
