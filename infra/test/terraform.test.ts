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
});
