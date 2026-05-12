/**
 * Maps availability service IDs to their aws-react-icons Architecture Service components.
 *
 * Icons use hardcoded AWS brand colors and do not respond to dark mode — this is intentional.
 * Platform engineers recognise AWS color coding as domain signal, not decoration.
 *
 * Coverage: 26 of 27 services. `landing-zones` has no AWS icon; callers should render a
 * text fallback instead.
 *
 * Icon naming convention: ArchitectureService + PascalCase SVG filename.
 * Only the `size` prop is supported (number | string, default 24).
 */
import ArchitectureServiceAmazonAthena from "aws-react-icons/icons/ArchitectureServiceAmazonAthena";
import ArchitectureServiceAmazonAurora from "aws-react-icons/icons/ArchitectureServiceAmazonAurora";
import ArchitectureServiceAmazonBedrockAgentCore from "aws-react-icons/icons/ArchitectureServiceAmazonBedrockAgentCore";
import ArchitectureServiceAmazonBedrock from "aws-react-icons/icons/ArchitectureServiceAmazonBedrock";
import ArchitectureServiceAmazonEC2 from "aws-react-icons/icons/ArchitectureServiceAmazonEC2";
import ArchitectureServiceAmazonECSAnywhere from "aws-react-icons/icons/ArchitectureServiceAmazonECSAnywhere";
import ArchitectureServiceAmazonEFS from "aws-react-icons/icons/ArchitectureServiceAmazonEFS";
import ArchitectureServiceAmazonEKSAnywhere from "aws-react-icons/icons/ArchitectureServiceAmazonEKSAnywhere";
import ArchitectureServiceAmazonElasticBlockStore from "aws-react-icons/icons/ArchitectureServiceAmazonElasticBlockStore";
import ArchitectureServiceAmazonElasticContainerRegistry from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import ArchitectureServiceAmazonElastiCache from "aws-react-icons/icons/ArchitectureServiceAmazonElastiCache";
import ArchitectureServiceAmazonEventBridge from "aws-react-icons/icons/ArchitectureServiceAmazonEventBridge";
import ArchitectureServiceAmazonKinesis from "aws-react-icons/icons/ArchitectureServiceAmazonKinesis";
import ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow from "aws-react-icons/icons/ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow";
import ArchitectureServiceAmazonSimpleNotificationService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleNotificationService";
import ArchitectureServiceAmazonSimpleQueueService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleQueueService";
import ArchitectureServiceAmazonSimpleStorageService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleStorageService";
import ArchitectureServiceAmazonTextract from "aws-react-icons/icons/ArchitectureServiceAmazonTextract";
import ArchitectureServiceAWSBackup from "aws-react-icons/icons/ArchitectureServiceAWSBackup";
import ArchitectureServiceAWSDatabaseMigrationService from "aws-react-icons/icons/ArchitectureServiceAWSDatabaseMigrationService";
import ArchitectureServiceAWSGlue from "aws-react-icons/icons/ArchitectureServiceAWSGlue";
import ArchitectureServiceAWSLambda from "aws-react-icons/icons/ArchitectureServiceAWSLambda";
import ArchitectureServiceAWSStepFunctions from "aws-react-icons/icons/ArchitectureServiceAWSStepFunctions";
import ArchitectureServiceAWSTransferFamily from "aws-react-icons/icons/ArchitectureServiceAWSTransferFamily";
import ArchitectureServiceElasticLoadBalancing from "aws-react-icons/icons/ArchitectureServiceElasticLoadBalancing";
import type { ComponentType } from "react";

type AwsIconComponent = ComponentType<{ size?: number | string }>;

export const AWS_ICON_MAP: Readonly<Record<string, AwsIconComponent>> = {
  s3: ArchitectureServiceAmazonSimpleStorageService,
  efs: ArchitectureServiceAmazonEFS,
  ebs: ArchitectureServiceAmazonElasticBlockStore,
  backup: ArchitectureServiceAWSBackup,
  ec2: ArchitectureServiceAmazonEC2,
  lambda: ArchitectureServiceAWSLambda,
  "ecs-fargate": ArchitectureServiceAmazonECSAnywhere,
  ecr: ArchitectureServiceAmazonElasticContainerRegistry,
  eks: ArchitectureServiceAmazonEKSAnywhere,
  // ecs-ec2 reuses the EC2 icon; the service label distinguishes it
  "ecs-ec2": ArchitectureServiceAmazonEC2,
  aurora: ArchitectureServiceAmazonAurora,
  elasticache: ArchitectureServiceAmazonElastiCache,
  kinesis: ArchitectureServiceAmazonKinesis,
  glue: ArchitectureServiceAWSGlue,
  athena: ArchitectureServiceAmazonAthena,
  sqs: ArchitectureServiceAmazonSimpleQueueService,
  sns: ArchitectureServiceAmazonSimpleNotificationService,
  eventbridge: ArchitectureServiceAmazonEventBridge,
  airflow: ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow,
  "step-functions": ArchitectureServiceAWSStepFunctions,
  transfer: ArchitectureServiceAWSTransferFamily,
  dms: ArchitectureServiceAWSDatabaseMigrationService,
  bedrock: ArchitectureServiceAmazonBedrock,
  agentcore: ArchitectureServiceAmazonBedrockAgentCore,
  textract: ArchitectureServiceAmazonTextract,
  elb: ArchitectureServiceElasticLoadBalancing,
};
