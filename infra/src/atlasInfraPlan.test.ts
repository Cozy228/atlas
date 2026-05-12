import { describe, expect, it } from "vitest";
import {
  buildAtlasInfraPlan,
  buildEnvironmentConfig,
  forbiddenV1Services,
} from "./atlasInfraPlan.js";

describe("Atlas infrastructure plan", () => {
  it("generates the V1 deployable resource plan from code", () => {
    const plan = buildAtlasInfraPlan(buildEnvironmentConfig("test"));

    expect(plan.resources.map((resource) => resource.type)).toEqual([
      "dynamodb-table",
      "lambda-function",
      "api-gateway",
      "secrets-manager-secret",
      "iam-role",
      "portal-hosting",
      "cloudwatch-log-group",
      "cloudwatch-metric",
    ]);
  });

  it("does not include managed retrieval or background workflow services", () => {
    const plan = buildAtlasInfraPlan(buildEnvironmentConfig("test"));
    const resourceTypes = plan.resources.map((resource) => resource.type);

    for (const forbidden of forbiddenV1Services) {
      expect(resourceTypes).not.toContain(forbidden);
    }
  });

  it("keeps local and test environments free of committed secrets", () => {
    const localConfig = buildEnvironmentConfig("local");
    const testConfig = buildEnvironmentConfig("test");

    expect(localConfig.source_system_secret_ref).toBeUndefined();
    expect(testConfig.llm_secret_ref).toBeUndefined();
  });

  it("uses secret references for production-like deployment", () => {
    const config = buildEnvironmentConfig("production-like");

    expect(config.source_system_secret_ref).toBe(
      "/atlas/production-like/source-system",
    );
    expect(config.llm_secret_ref).toBe("/atlas/production-like/llm-provider");
  });

  it("captures source selection, anchor resolution, warning, and API error signals", () => {
    const plan = buildAtlasInfraPlan(buildEnvironmentConfig("test"));

    expect(plan.observability.metrics).toEqual([
      "source_selection_count",
      "anchor_resolution_failure_count",
      "context_bundle_warning_count",
      "api_error_count",
    ]);
  });

  it("expresses the V1 resource plan as Terraform IaC", () => {
    const plan = buildAtlasInfraPlan(buildEnvironmentConfig("test"));
    const mainTerraform = plan.terraform_files.find(
      (file) => file.path === "main.tf",
    )?.content;

    expect(mainTerraform).toContain('resource "aws_dynamodb_table"');
    expect(mainTerraform).toContain('resource "aws_lambda_function"');
    expect(mainTerraform).toContain('resource "aws_apigatewayv2_api"');
    expect(mainTerraform).toContain('resource "aws_secretsmanager_secret"');
    expect(mainTerraform).toContain('resource "aws_iam_role"');
    expect(mainTerraform).toContain('resource "aws_cloudwatch_log_group"');
  });
});
