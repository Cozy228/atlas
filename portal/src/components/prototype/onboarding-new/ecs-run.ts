import type { EcsStage } from "./ecs-journey";
import type { ScaffoldFileConfig } from "./scaffold-files";

export type ExecutionPhase =
  | "waiting-pr"
  | "checking-pipeline"
  | "waiting-tfe"
  | "planning"
  | "awaiting-apply"
  | "applying"
  | "task-definition"
  | "waiting-app-pr"
  | "waiting-resources"
  | "running-resources"
  | "waiting-ci"
  | "building"
  | "waiting-deploy"
  | "deploying"
  | "complete";
export const executionPhases = [
  {
    id: "waiting-pr",
    title: "Infrastructure PR",
    detail:
      "Review and merge the infrastructure PR in GitHub, then return here to check its status.",
    stage: "result",
    duration: 0,
  },
  {
    id: "checking-pipeline",
    title: "Provision the infrastructure first",
    detail:
      "Run the Harness infrastructure pipeline to create the cluster, load balancer, registry and log group.",
    stage: "pipelines",
    duration: 0,
  },
  {
    id: "waiting-tfe",
    title: "Waiting for Terraform Enterprise",
    detail:
      "Harness has started the infrastructure pipeline. The Terraform Enterprise plan has not started yet.",
    stage: "pipelines",
    duration: 0,
  },
  {
    id: "planning",
    title: "Terraform plan in progress",
    detail: "Terraform Enterprise is calculating the plan. AWS resources have not changed yet.",
    stage: "pipelines",
    duration: 5000,
  },
  {
    id: "awaiting-apply",
    title: "Approve the Terraform plan",
    detail: "Review the planned resources in Harness and approve Terraform apply to create them.",
    stage: "pipelines",
    duration: 0,
  },
  {
    id: "applying",
    title: "Creating the infrastructure",
    detail:
      "Terraform Enterprise is applying the approved plan through Harness. Infrastructure outputs become available after apply succeeds.",
    stage: "pipelines",
    duration: 8000,
  },
  {
    id: "task-definition",
    title: "Review the application PR",
    detail:
      "The infrastructure outputs are ready. Review the generated task definition and application files before creating the application PR.",
    stage: "task-definition",
    duration: 0,
  },
  {
    id: "waiting-app-pr",
    title: "Application PR",
    detail: "Review and merge the application PR in GitHub, then return here to check its status.",
    stage: "task-definition",
    duration: 0,
  },
  {
    id: "waiting-resources",
    title: "Create Harness resources first",
    detail:
      "Run the Harness resources pipeline to create the Service, Environment, Overrides, File Store and deployment pipeline.",
    stage: "resources",
    duration: 0,
  },
  {
    id: "running-resources",
    title: "Creating Harness resources",
    detail:
      "The self-service pipeline is creating the application resources needed for deployment.",
    stage: "resources",
    duration: 4000,
  },
  {
    id: "waiting-ci",
    title: "Build the application image",
    detail:
      "The task definition is updated. Run the application CI pipeline to build and publish the image.",
    stage: "build",
    duration: 0,
  },
  {
    id: "building",
    title: "Application CI is running",
    detail:
      "Building and publishing the container image. Service deployment waits for a successful build.",
    stage: "build",
    duration: 5000,
  },
  {
    id: "waiting-deploy",
    title: "Deploy the ECS service",
    detail:
      "The image is ready. Run the service deploy pipeline with the CI image tag and resolved infrastructure.",
    stage: "run",
    duration: 0,
  },
  {
    id: "deploying",
    title: "Deploying your service",
    detail:
      "Harness is running Terraform to deploy the published image. Waiting for the deployment run and ECS health checks to succeed.",
    stage: "run",
    duration: 5500,
  },
  {
    id: "complete",
    title: "Your service is ready",
    detail: "Open the service endpoint to verify the application, then finish this journey.",
    stage: "verify",
    duration: 0,
  },
] satisfies {
  id: ExecutionPhase;
  title: string;
  detail: string;
  stage: EcsStage;
  duration: number;
}[];
export const runPhaseKey = "journey:ecs-service:run-phase";
export const prKinds = ["infra", "app"];
const phaseIndex = new Map(executionPhases.map((phase, index) => [phase.id, index]));
function phaseReached(current: ExecutionPhase, target: ExecutionPhase) {
  return (phaseIndex.get(current) ?? -1) >= (phaseIndex.get(target) ?? Number.MAX_SAFE_INTEGER);
}

export function prCreated(values: Record<string, string>, kind: string) {
  return values[`journey:ecs-service:pr:${kind}`] === "simulated";
}
export function prState(values: Record<string, string>, kind: string) {
  const state = values[`journey:ecs-service:pr-state:${kind}`];
  return state === "merged" || state === "closed" || state === "unknown" ? state : "open";
}
export const allPrsMerged = (values: Record<string, string>) =>
  prKinds.every((kind) => prState(values, kind) === "merged");
export function executionPhase(value: string | undefined) {
  return executionPhases.find((phase) => phase.id === value);
}
export function nextExecutionPhase(value: string) {
  const index = executionPhases.findIndex((phase) => phase.id === value);
  return index < 0 ? undefined : executionPhases[index + 1];
}
export function executionPatch(
  phase: ExecutionPhase,
  serviceName: string,
  account = "000000000000",
): Record<string, string> {
  const current = executionPhase(phase);
  if (!current) return {};
  const infraPrCreated = phaseReached(phase, "waiting-pr");
  const infraPrMerged = phaseReached(phase, "checking-pipeline");
  const infrastructureReady = phaseReached(phase, "task-definition");
  const appPrCreated = phaseReached(phase, "waiting-app-pr");
  const appPrMerged = phaseReached(phase, "waiting-resources");
  const resourcesReady = phaseReached(phase, "waiting-ci");
  const imageReady = phaseReached(phase, "waiting-deploy");
  const encodedService = encodeURIComponent(serviceName);
  return {
    [runPhaseKey]: phase,
    "journey:ecs-service:apply-step": "0",
    "scaffold:stage": current.stage,
    "journey:ecs-service:completed:config": "true",
    "journey:ecs-service:completed:preview": String(infraPrCreated),
    "journey:ecs-service:completed:result": String(infraPrMerged),
    "journey:ecs-service:completed:resources": String(resourcesReady),
    "journey:ecs-service:completed:pipelines": String(infrastructureReady),
    "journey:ecs-service:completed:task-definition": String(appPrMerged),
    "journey:ecs-service:completed:build": String(imageReady),
    "journey:ecs-service:completed:run": String(phase === "complete"),
    "journey:ecs-service:completed:verify": "false",
    "journey:ecs-service:infra-run": String(infrastructureReady),
    "journey:ecs-service:ci-run": String(imageReady),
    "journey:ecs-service:app-run": String(phase === "complete"),
    "journey:ecs-service:verified": String(phase === "complete"),
    ...(infraPrCreated
      ? {
          "journey:ecs-service:pr:infra": "simulated",
        }
      : {}),
    ...(phase === "waiting-pr"
      ? {
          "journey:ecs-service:pr-state:infra": "open",
          "journey:ecs-service:pr:app": "",
          "journey:ecs-service:pr-state:app": "",
        }
      : {}),
    ...(appPrCreated
      ? {
          "journey:ecs-service:pr:app": "simulated",
        }
      : {}),
    ...(phase === "waiting-app-pr"
      ? {
          "journey:ecs-service:pr-state:app": "open",
        }
      : {}),
    ...(phaseReached(phase, "waiting-resources")
      ? {
          "artifact:harness-resources-pipeline:pipeline": "Create_Harness_Resources_For_AWS",
          "artifact:harness-resources-pipeline:url":
            "https://harness.example.com/pipelines/Create_Harness_Resources_For_AWS/executions",
        }
      : {}),
    ...(infraPrMerged
      ? {
          "artifact:infra-pipeline:pipeline": `${serviceName}-infra`,
          "artifact:infra-pipeline:url": `https://harness.example.com/pipelines/${encodedService}-infra`,
          "journey:ecs-service:infra-pipeline-source": "simulated",
        }
      : {}),
    ...(phaseReached(phase, "waiting-ci")
      ? {
          "artifact:ci-pipeline:pipeline": `${serviceName}-ci`,
          "artifact:ci-pipeline:url": `https://harness.example.com/pipelines/${encodedService}-ci`,
        }
      : {}),
    ...(resourcesReady
      ? {
          "artifact:app-pipeline:pipeline": `${serviceName}-deploy`,
          "artifact:app-pipeline:url": `https://harness.example.com/pipelines/${encodedService}-deploy`,
        }
      : {}),
    ...(resourcesReady
      ? {
          "artifact:harness-resources:service": serviceName,
          "artifact:harness-resources:environment": "DEV",
          "artifact:harness-resources:overrides": `${serviceName}-overrides.yaml`,
          "artifact:harness-resources:fileStore": `${serviceName}-task-definition.yaml`,
          "artifact:harness-resources:url": `https://harness.example.com/projects/${encodedService}`,
        }
      : {}),
    ...(infrastructureReady
      ? {
          "journey:ecs-service:output:taskRoleArn": `arn:aws:iam::${account || "000000000000"}:role/${serviceName}-task`,
          "journey:ecs-service:output:executionRoleArn": `arn:aws:iam::${account || "000000000000"}:role/${serviceName}-execution`,
          "journey:ecs-service:output:logGroup": `/ecs/${serviceName}`,
          "journey:ecs-service:output:cluster": `${serviceName}-cluster`,
          "journey:ecs-service:output:vpcId": `vpc-${encodedService}-dev`,
          "journey:ecs-service:output:privateSubnetIds": `subnet-${encodedService}-a,subnet-${encodedService}-b`,
          "journey:ecs-service:output:taskSecurityGroupIds": `sg-${encodedService}-tasks`,
          "journey:ecs-service:output:targetGroupArn": `arn:aws:elasticloadbalancing:us-east-1:${account || "000000000000"}:targetgroup/${encodedService}/simulated`,
          "journey:ecs-service:output:loadBalancerDns": `${encodedService}-alb.dev.example.com`,
        }
      : {}),
    ...(appPrCreated
      ? {
          "artifact:task-definition:path": "ecs/task-definition.json",
          "artifact:task-definition:taskRoleArn": `arn:aws:iam::${account || "000000000000"}:role/${serviceName}-task`,
          "artifact:task-definition:executionRoleArn": `arn:aws:iam::${account || "000000000000"}:role/${serviceName}-execution`,
          "artifact:task-definition:logGroup": `/ecs/${serviceName}`,
          "artifact:task-definition:revision": "application-pr-1",
        }
      : {}),
    ...(imageReady
      ? {
          "artifact:ci-pipeline:image": `${serviceName}:build-001`,
          "journey:ecs-service:output:imageTag": "build-001",
        }
      : {}),
    ...(phase === "complete"
      ? {
          "artifact:deployment:service": serviceName,
          "artifact:deployment:environment": "DEV",
          "artifact:deployment:version": "build-001",
          "artifact:deployment:url": `https://${encodedService}.dev.example.com`,
        }
      : {}),
  };
}

export function executionInputs(
  config: ScaffoldFileConfig,
  values: Record<string, string>,
): Record<string, string> {
  return {
    ...Object.fromEntries(
      Object.entries(config).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    buildMethod: config.buildMethod ?? "java-maven-docker",
    projectName: values["artifact:service-project:project"] || config.appRepo || config.serviceName,
    environmentName: `${config.serviceName}-dev`,
    artifactoryRepo: `${config.serviceName}-docker-deploy`,
    awsConnectorId: `org.${config.serviceName}-aws-connector`,
    ecrRepositoryName: config.serviceName,
    gitRef: "main",
    imageTag: values["journey:ecs-service:output:imageTag"] ?? "build-001",
    cluster: values["journey:ecs-service:output:cluster"] ?? config.cluster,
    taskDefinition: "ecs/task-definition.json",
    logGroup: values["journey:ecs-service:output:logGroup"] ?? "",
    taskRoleArn: values["journey:ecs-service:output:taskRoleArn"] ?? "",
    executionRoleArn: values["journey:ecs-service:output:executionRoleArn"] ?? "",
    vpcId: values["journey:ecs-service:output:vpcId"] ?? "",
    privateSubnetIds: values["journey:ecs-service:output:privateSubnetIds"] ?? "",
    taskSecurityGroupIds: values["journey:ecs-service:output:taskSecurityGroupIds"] ?? "",
    targetGroupArn: values["journey:ecs-service:output:targetGroupArn"] ?? "",
    loadBalancerDns: values["journey:ecs-service:output:loadBalancerDns"] ?? "",
  };
}
