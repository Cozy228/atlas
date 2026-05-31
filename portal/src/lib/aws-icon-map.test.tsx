import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { AWS_ICON_MAP } from "./aws-icon-map";

describe("AWS_ICON_MAP", () => {
  it("does not import aws-react-icons through its extensionless ESM barrel", async () => {
    const source = await readFile(new URL("./aws-icon-map.tsx", import.meta.url), "utf8");

    expect(source).not.toContain('from "aws-react-icons";');
  });

  it("loads AWS service icons through Node-compatible package exports", () => {
    expect(AWS_ICON_MAP.s3).toBeTypeOf("function");
    expect(AWS_ICON_MAP.lambda).toBeTypeOf("function");
    expect(AWS_ICON_MAP.agentcore).toBeTypeOf("function");
  });

  it("maps the expanded AWS availability services to icon components", () => {
    const serviceIds = [
      "cloudfront",
      "route53",
      "api-gateway",
      "cloudwatch",
      "dynamodb",
      "rds",
      "documentdb",
      "neptune",
      "opensearch",
      "redshift",
      "emr",
      "msk",
      "mq",
      "cognito",
      "appsync",
      "sagemaker",
      "rekognition",
      "comprehend",
      "translate",
      "transcribe",
      "polly",
      "connect",
      "iam-identity-center",
      "kms",
      "secrets-manager",
      "cloudformation",
      "cloudtrail",
      "config",
      "systems-manager",
      "guardduty",
      "security-hub",
      "waf",
      "direct-connect",
      "privatelink",
    ] as const;

    for (const serviceId of serviceIds) {
      expect(AWS_ICON_MAP[serviceId], serviceId).toBeTypeOf("function");
    }
  });
});
