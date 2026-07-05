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

  // D10 — the consumer-state `apps` table is provisioned like feedback (Step 3,
  // locked decision 3): the table, the task-role IAM to read/write it, and the
  // `APPS_TABLE` ECS env wiring that the prod fail-fast guard reads.
  it("provisions the DynamoDB apps table, its IAM access, and the APPS_TABLE env", () => {
    expect(mainTerraform).toContain('resource "aws_dynamodb_table" "apps"');
    expect(mainTerraform).toContain("aws_dynamodb_table.apps.arn");
    expect(mainTerraform).toContain(
      '{ name = "APPS_TABLE", value = aws_dynamodb_table.apps.name }',
    );
  });

  // D13 — the durable change-feed `events` table is provisioned like apps/feedback
  // (Step 2, M1): the table, task-role IAM to read/write it + its gsi1 index, and
  // the `EVENTS_TABLE` ECS env wiring the prod fail-fast guard reads.
  it("provisions the DynamoDB events table, its IAM access, and the EVENTS_TABLE env", () => {
    expect(mainTerraform).toContain('resource "aws_dynamodb_table" "events"');
    expect(mainTerraform).toContain("aws_dynamodb_table.events.arn");
    expect(mainTerraform).toContain('"${aws_dynamodb_table.events.arn}/index/*"');
    expect(mainTerraform).toContain(
      '{ name = "EVENTS_TABLE", value = aws_dynamodb_table.events.name }',
    );
  });

  // The lifecycle-plane graph snapshot refresh is opt-in via GRAPH_REFRESH_INTERVAL_MS;
  // prod ECS must set the recommended 15 min cadence or the live change feed stays unfed.
  it("wires the GRAPH_REFRESH_INTERVAL_MS env for the lifecycle graph refresh", () => {
    expect(mainTerraform).toContain('{ name = "GRAPH_REFRESH_INTERVAL_MS", value = "900000" }');
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
