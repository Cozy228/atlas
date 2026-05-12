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
});
