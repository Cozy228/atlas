import { getScaffoldBuildMethod, type ScaffoldBuildMethodId } from "./scaffold-build";

export type ScaffoldFileConfig = {
  serviceName: string;
  environment: string;
  region: string;
  cluster: string;
  infraRepo: string;
  appRepo: string;
  stackName: string;
  account: string;
  exposure: string;
  buildMethod?: ScaffoldBuildMethodId;
  taskRoleArn?: string;
  executionRoleArn?: string;
  logGroup?: string;
  imageTag?: string;
  privateSubnetIds?: string;
  taskSecurityGroupIds?: string;
  targetGroupArn?: string;
};

export type ScaffoldFile = {
  id: string;
  repository: string;
  scope: "infra" | "app";
  path: string;
  description: string;
  content: string;
};

function terraformString(value: string) {
  const encoded = JSON.stringify(value);
  return encoded.replace(/\$\{/g, () => "$${").replace(/%\{/g, () => "%%{");
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

export function buildScaffoldFiles(config: ScaffoldFileConfig): ScaffoldFile[] {
  const buildCommand = getScaffoldBuildMethod(config.buildMethod).command;
  const isPublic = config.exposure.toLowerCase() === "public";
  const terraform = `# Preview only: illustrative ECS scaffold; no infrastructure is applied.
locals {
  service_name          = ${terraformString(config.serviceName)}
  environment           = ${terraformString(config.environment)}
  region                = ${terraformString(config.region)}
  cluster               = ${terraformString(config.cluster)}
  account               = ${terraformString(config.account)}
  exposure              = ${terraformString(config.exposure)}
  infrastructure_repo   = ${terraformString(config.infraRepo)}
}

resource "aws_ecr_repository" "preview" {
  name = local.service_name
}

resource "aws_cloudwatch_log_group" "preview" {
  name = "/ecs/${terraformString(config.serviceName).slice(1, -1)}"
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task" {
  name               = "${terraformString(config.serviceName).slice(1, -1)}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role" "execution" {
  name               = "${terraformString(config.serviceName).slice(1, -1)}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

output "task_role_arn" {
  value = aws_iam_role.task.arn
}

output "execution_role_arn" {
  value = aws_iam_role.execution.arn
}

# Network, certificate and security group inputs are resolved from the platform.
resource "aws_lb" "preview" {
  name               = local.service_name
  load_balancer_type = "application"
  internal           = ${!isPublic}
  subnets            = var.alb_subnet_ids
  security_groups    = var.alb_security_group_ids
}

resource "aws_lb_target_group" "preview" {
  name        = local.service_name
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.preview.arn
  port             = 443
  protocol         = "HTTPS"
  certificate_arn  = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.preview.arn
  }
}

resource "aws_route53_record" "service" {
  zone_id = var.private_hosted_zone_id
  name    = "${terraformString(config.serviceName).slice(1, -1)}.dev.example.com"
  type    = "A"
  alias {
    name                   = aws_lb.preview.dns_name
    zone_id                = aws_lb.preview.zone_id
    evaluate_target_health = true
  }
}

resource "aws_ecs_cluster" "preview" {
  name = local.cluster
}


`;

  const applicationTerraform = `# Preview only: Harness runs Terraform to deploy the application.
locals {
  task = jsondecode(file("ecs/task-definition.json"))
}

resource "aws_ecs_task_definition" "application" {
  family                   = local.task.family
  network_mode             = local.task.networkMode
  requires_compatibilities = local.task.requiresCompatibilities
  cpu                      = local.task.cpu
  memory                   = local.task.memory
  task_role_arn            = local.task.taskRoleArn
  execution_role_arn       = local.task.executionRoleArn
  container_definitions    = jsonencode([
    for container in local.task.containerDefinitions : merge(container, { image = var.image_uri })
  ])
}

resource "aws_ecs_service" "application" {
  name            = ${terraformString(config.serviceName)}
  cluster         = ${terraformString(config.cluster)}
  task_definition = aws_ecs_task_definition.application.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = ${
      config.privateSubnetIds
        ? `[${config.privateSubnetIds
            .split(",")
            .map((id) => terraformString(id.trim()))
            .join(", ")}]`
        : "var.private_subnet_ids"
    }
    security_groups  = ${
      config.taskSecurityGroupIds
        ? `[${config.taskSecurityGroupIds
            .split(",")
            .map((id) => terraformString(id.trim()))
            .join(", ")}]`
        : "var.task_security_group_ids"
    }
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = ${config.targetGroupArn ? terraformString(config.targetGroupArn) : "var.target_group_arn"}
    container_name  = ${terraformString(config.serviceName)}
    container_port  = 8080
  }
}
`;

  const infrastructurePipeline = `# Preview only: illustrative infrastructure pipeline; no deployment is run.
version: 1
name: ${yamlString(config.stackName)}
repository: ${yamlString(config.infraRepo)}
inputs:
  service_name: ${yamlString(config.serviceName)}
  environment: ${yamlString(config.environment)}
  region: ${yamlString(config.region)}
  cluster: ${yamlString(config.cluster)}
  account: ${yamlString(config.account)}
  exposure: ${yamlString(config.exposure)}
steps:
  - name: "terraform plan"
    action: "preview"
  - name: "review"
    action: "manual approval"
  - name: "terraform apply"
    action: "preview"
`;

  const taskDefinition = {
    family: config.serviceName,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: "256",
    memory: "512",
    executionRoleArn: config.executionRoleArn || "<resolve:execution-role-arn>",
    taskRoleArn: config.taskRoleArn || "<resolve:task-role-arn>",
    containerDefinitions: [
      {
        name: config.serviceName,
        image: `${config.account || "<account-id>"}.dkr.ecr.${config.region}.amazonaws.com/${config.serviceName}:${config.imageTag || "<ci-image-tag>"}`,
        essential: true,
        portMappings: [{ containerPort: 8080, protocol: "tcp" }],
        environment: [
          { name: "APP_ENV", value: config.environment },
          { name: "AWS_REGION", value: config.region },
          { name: "EXPOSURE", value: config.exposure },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group": config.logGroup || `<resolve:log-group>`,
            "awslogs-region": config.region,
            "awslogs-stream-prefix": "ecs",
          },
        },
      },
    ],
    tags: [
      { key: "Environment", value: config.environment },
      { key: "Cluster", value: config.cluster },
      { key: "Exposure", value: config.exposure },
      { key: "Account", value: config.account },
      { key: "Stack", value: config.stackName },
    ],
  };

  const applicationPipeline = `# Preview only: illustrative application pipeline; no deployment is run.
version: 1
name: ${yamlString(config.stackName)}
repository: ${yamlString(config.appRepo)}
service: ${yamlString(config.serviceName)}
environment: ${yamlString(config.environment)}
region: ${yamlString(config.region)}
cluster: ${yamlString(config.cluster)}
account: ${yamlString(config.account)}
exposure: ${yamlString(config.exposure)}
task_definition: "ecs/task-definition.json"
image_tag: ${yamlString(config.imageTag || "<ci-image-tag>")}
requires:
  - "infrastructure apply successful"
  - "application CI successful"
steps:
  - name: "terraform plan ECS application"
    action: "preview"
  - name: "terraform apply ECS application"
    action: "preview"
`;

  return [
    {
      id: "infra-ecs-service",
      repository: config.infraRepo,
      scope: "infra",
      path: "ecs/service.tf",
      description:
        "ALB, target group, cluster, ECR, IAM and logs. The application Terraform creates the ECS service after the image is built.",
      content: terraform,
    },
    {
      id: "infra-pipeline",
      repository: config.infraRepo,
      scope: "infra",
      path: "pipelines/infra.yaml",
      description: "Preview infrastructure pipeline",
      content: infrastructurePipeline,
    },
    {
      id: "app-ecs-task-definition",
      repository: config.appRepo,
      scope: "app",
      path: "ecs/task-definition.json",
      description: "Preview ECS task definition",
      content: JSON.stringify(taskDefinition, null, 2),
    },
    {
      id: "app-ecs-deployment",
      repository: config.appRepo,
      scope: "app",
      path: "ecs/deployment.tf",
      description:
        "Harness applies Terraform to register the task definition and deploy the built image to ECS.",
      content: applicationTerraform,
    },
    {
      id: "app-ci-pipeline",
      repository: config.appRepo,
      scope: "app",
      path: "pipelines/ci.yaml",
      description: "Build and publish the application image after the task definition is updated",
      content: `# Preview only: illustrative application CI pipeline.
name: ${yamlString(`${config.serviceName}-ci`)}
repository: ${yamlString(config.appRepo)}
requires:
  - "task definition updated from infrastructure outputs"
steps:
  - name: "build image"
    command: ${yamlString(buildCommand)}
  - name: "publish image"
    action: "preview"
outputs:
  - "image tag"
`,
    },
    {
      id: "app-pipeline",
      repository: config.appRepo,
      scope: "app",
      path: "pipelines/deploy.yaml",
      description: "Preview application deployment pipeline",
      content: applicationPipeline,
    },
  ];
}
