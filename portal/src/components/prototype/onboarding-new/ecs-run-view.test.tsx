import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EcsRunView } from "./ecs-run-view";
import { executionPatch } from "./ecs-run";

it("shows the full application preview before offering to create the application PR", () => {
  const html = renderToStaticMarkup(
    <EcsRunView
      config={{
        serviceName: "checkout-api",
        environment: "dev",
        region: "us-east-1",
        cluster: "sample-cluster",
        infraRepo: "sample/infra",
        appRepo: "sample/app",
        stackName: "sample-stack",
        account: "123456789012",
        exposure: "internal",
      }}
      values={{
        ...executionPatch("task-definition", "checkout-api", "123456789012"),
        "artifact:app-repository:repository": "sample/app",
        "journey:ecs-service:github-authorized": "true",
      }}
      onValueChange={() => {}}
      onFinish={() => {}}
      onEdit={() => {}}
      onRepositorySetup={() => {}}
    />,
  );
  expect(html).toContain('aria-label="Change preview"');
  expect(html).toContain("File changes");
  expect(html).toContain("Create application PR");
  expect(html.indexOf('aria-label="Change preview"')).toBeLessThan(
    html.indexOf("Create application PR"),
  );
  expect(html).not.toContain("Review files");
});
