import { describe, expect, it } from "vitest";
import { buildScaffoldFiles, type ScaffoldFileConfig } from "./scaffold-files";

const config: ScaffoldFileConfig = {
  serviceName: "catalog-api",
  environment: "DEV",
  region: "us-east-1",
  cluster: "shared-dev",
  infraRepo: "demo-infra",
  appRepo: "demo-app",
  stackName: "catalog-dev",
  account: "123456789012",
  exposure: "internal",
};

function fileAt(files: ReturnType<typeof buildScaffoldFiles>, path: string) {
  const file = files.find((item) => item.path === path);
  if (!file) throw new Error(`Missing generated file: ${path}`);
  return file;
}

describe("buildScaffoldFiles", () => {
  it("keeps PR ownership separate when repository names match", () => {
    const files = buildScaffoldFiles({ ...config, infraRepo: "shared", appRepo: "shared" });
    expect(files.filter((file) => file.scope === "infra").map((file) => file.path)).toEqual([
      "ecs/service.tf",
      "pipelines/infra.yaml",
    ]);
    expect(files.filter((file) => file.scope === "app")).toHaveLength(4);
  });
  it("renders infrastructure and application changes in separate repositories", () => {
    const files = buildScaffoldFiles(config);

    expect(files).toHaveLength(6);
    const content = files.map((file) => file.content).join("\n");
    for (const value of Object.values(config)) expect(content).toContain(value);
    for (const resource of [
      "aws_lb",
      "aws_lb_listener",
      "aws_lb_target_group",
      "aws_ecs_cluster",
      "aws_ecr_repository",
      "aws_cloudwatch_log_group",
      "aws_iam_role",
      "aws_iam_role_policy_attachment",
      "aws_route53_record",
    ]) {
      expect(fileAt(files, "ecs/service.tf").content).toContain(`resource "${resource}"`);
    }
    expect(fileAt(files, "ecs/service.tf").content).toContain('target_type = "ip"');
    expect(fileAt(files, "ecs/service.tf").content).not.toContain('resource "aws_ecs_service"');
    expect(fileAt(files, "ecs/deployment.tf").content).toContain('resource "aws_ecs_service"');
    expect(fileAt(files, "ecs/deployment.tf").content).toContain(
      'resource "aws_ecs_task_definition"',
    );
    expect(fileAt(files, "pipelines/deploy.yaml").content).toContain(
      "terraform apply ECS application",
    );
    expect(fileAt(files, "ecs/task-definition.json").content).toContain(
      '"requiresCompatibilities"',
    );
  });

  it("changes exposure-specific preview settings", () => {
    const internal = buildScaffoldFiles(config);
    const publicFiles = buildScaffoldFiles({ ...config, exposure: "public" });
    const internalTerraform = fileAt(internal, "ecs/service.tf").content;
    const publicTerraform = fileAt(publicFiles, "ecs/service.tf").content;

    expect(fileAt(internal, "ecs/deployment.tf").content).toContain("assign_public_ip = false");
    expect(fileAt(publicFiles, "ecs/deployment.tf").content).toContain("assign_public_ip = false");
    expect(internalTerraform).toContain("internal           = true");
    expect(publicTerraform).toContain("internal           = false");
    expect(internalTerraform).toContain('exposure              = "internal"');
    expect(publicTerraform).toContain('exposure              = "public"');
    expect(fileAt(internal, "pipelines/deploy.yaml").content).toContain('exposure: "internal"');
    expect(fileAt(publicFiles, "pipelines/deploy.yaml").content).toContain('exposure: "public"');
  });

  it("escapes interpolation markers and preserves injected values as data", () => {
    const injected = {
      ...config,
      serviceName: 'demo"${danger}\\service',
      exposure: "%{directive}",
    };
    const files = buildScaffoldFiles(injected);
    const terraform = fileAt(files, "ecs/service.tf").content;
    const taskDefinition = JSON.parse(fileAt(files, "ecs/task-definition.json").content);

    expect(terraform).toContain('service_name          = "demo\\"$${danger}\\\\service"');
    expect(terraform).toContain('exposure              = "%%{directive}"');
    expect(taskDefinition.family).toBe(injected.serviceName);
    expect(fileAt(files, "pipelines/infra.yaml").content).toContain('exposure: "%{directive}"');
  });

  it("uses Maven and Docker by default and supports an existing Dockerfile", () => {
    expect(fileAt(buildScaffoldFiles(config), "pipelines/ci.yaml").content).toContain(
      "./mvnw -B package && docker build",
    );
    const pipeline = fileAt(
      buildScaffoldFiles({ ...config, buildMethod: "dockerfile" }),
      "pipelines/ci.yaml",
    ).content;
    expect(pipeline).toContain("docker build");
    expect(pipeline).not.toContain("mvnw");
  });

  it("groups infrastructure and application files under their target repositories", () => {
    const files = buildScaffoldFiles(config);
    const byRepository = new Map<string, string[]>();
    for (const file of files) {
      const paths = byRepository.get(file.repository) ?? [];
      paths.push(file.path);
      byRepository.set(file.repository, paths);
    }

    expect(byRepository).toEqual(
      new Map([
        [config.infraRepo, ["ecs/service.tf", "pipelines/infra.yaml"]],
        [
          config.appRepo,
          [
            "ecs/task-definition.json",
            "ecs/deployment.tf",
            "pipelines/ci.yaml",
            "pipelines/deploy.yaml",
          ],
        ],
      ]),
    );
    expect(
      files.every(
        (file) =>
          Object.keys(file).sort().join(",") === "content,description,id,path,repository,scope",
      ),
    ).toBe(true);
  });
});

it("uses infrastructure outputs in the task definition and keeps CI separate from deploy", () => {
  const resolved = {
    ...config,
    taskRoleArn: "arn:aws:iam::123456789012:role/catalog-task",
    executionRoleArn: "arn:aws:iam::123456789012:role/catalog-execution",
    logGroup: "/ecs/catalog-resolved",
    imageTag: "build-002",
    privateSubnetIds: "subnet-00000000000000001,subnet-00000000000000002",
    taskSecurityGroupIds: "sg-00000000000000001",
    targetGroupArn:
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/catalog/example",
  };
  const files = buildScaffoldFiles(resolved);
  const definition = JSON.parse(fileAt(files, "ecs/task-definition.json").content);
  expect(definition.taskRoleArn).toBe(resolved.taskRoleArn);
  expect(definition.executionRoleArn).toBe(resolved.executionRoleArn);
  expect(definition.containerDefinitions[0].logConfiguration.options["awslogs-group"]).toBe(
    resolved.logGroup,
  );
  expect(definition.containerDefinitions[0].image).toContain(":build-002");
  const deployment = fileAt(files, "ecs/deployment.tf").content;
  expect(deployment).toContain('["subnet-00000000000000001", "subnet-00000000000000002"]');
  expect(deployment).toContain(resolved.targetGroupArn);
  expect(deployment).toContain(resolved.taskSecurityGroupIds);
  expect(deployment).not.toContain("var.target_group_arn");
  expect(fileAt(files, "pipelines/ci.yaml").content).toContain("build image");
  expect(fileAt(files, "pipelines/deploy.yaml").content).not.toContain("build image");
});
