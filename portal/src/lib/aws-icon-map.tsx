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
import ArchitectureServiceAmazonAPIGateway from "aws-react-icons/icons/ArchitectureServiceAmazonAPIGateway";
import ArchitectureServiceAmazonAthena from "aws-react-icons/icons/ArchitectureServiceAmazonAthena";
import ArchitectureServiceAmazonAurora from "aws-react-icons/icons/ArchitectureServiceAmazonAurora";
import ArchitectureServiceAmazonBedrockAgentCore from "aws-react-icons/icons/ArchitectureServiceAmazonBedrockAgentCore";
import ArchitectureServiceAmazonBedrock from "aws-react-icons/icons/ArchitectureServiceAmazonBedrock";
import ArchitectureServiceAmazonCloudFront from "aws-react-icons/icons/ArchitectureServiceAmazonCloudFront";
import ArchitectureServiceAmazonCloudWatch from "aws-react-icons/icons/ArchitectureServiceAmazonCloudWatch";
import ArchitectureServiceAmazonCognito from "aws-react-icons/icons/ArchitectureServiceAmazonCognito";
import ArchitectureServiceAmazonComprehend from "aws-react-icons/icons/ArchitectureServiceAmazonComprehend";
import ArchitectureServiceAmazonConnect from "aws-react-icons/icons/ArchitectureServiceAmazonConnect";
import ArchitectureServiceAmazonDocumentDB from "aws-react-icons/icons/ArchitectureServiceAmazonDocumentDB";
import ArchitectureServiceAmazonDynamoDB from "aws-react-icons/icons/ArchitectureServiceAmazonDynamoDB";
import ArchitectureServiceAmazonEC2 from "aws-react-icons/icons/ArchitectureServiceAmazonEC2";
import ArchitectureServiceAmazonECSAnywhere from "aws-react-icons/icons/ArchitectureServiceAmazonECSAnywhere";
import ArchitectureServiceAmazonEFS from "aws-react-icons/icons/ArchitectureServiceAmazonEFS";
import ArchitectureServiceAmazonEKSAnywhere from "aws-react-icons/icons/ArchitectureServiceAmazonEKSAnywhere";
import ArchitectureServiceAmazonElasticBlockStore from "aws-react-icons/icons/ArchitectureServiceAmazonElasticBlockStore";
import ArchitectureServiceAmazonElasticContainerRegistry from "aws-react-icons/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import ArchitectureServiceAmazonElastiCache from "aws-react-icons/icons/ArchitectureServiceAmazonElastiCache";
import ArchitectureServiceAmazonEMR from "aws-react-icons/icons/ArchitectureServiceAmazonEMR";
import ArchitectureServiceAmazonEventBridge from "aws-react-icons/icons/ArchitectureServiceAmazonEventBridge";
import ArchitectureServiceAmazonGuardDuty from "aws-react-icons/icons/ArchitectureServiceAmazonGuardDuty";
import ArchitectureServiceAmazonKinesis from "aws-react-icons/icons/ArchitectureServiceAmazonKinesis";
import ArchitectureServiceAmazonManagedStreamingforApacheKafka from "aws-react-icons/icons/ArchitectureServiceAmazonManagedStreamingforApacheKafka";
import ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow from "aws-react-icons/icons/ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow";
import ArchitectureServiceAmazonMQ from "aws-react-icons/icons/ArchitectureServiceAmazonMQ";
import ArchitectureServiceAmazonNeptune from "aws-react-icons/icons/ArchitectureServiceAmazonNeptune";
import ArchitectureServiceAmazonOpenSearchService from "aws-react-icons/icons/ArchitectureServiceAmazonOpenSearchService";
import ArchitectureServiceAmazonPolly from "aws-react-icons/icons/ArchitectureServiceAmazonPolly";
import ArchitectureServiceAmazonRDS from "aws-react-icons/icons/ArchitectureServiceAmazonRDS";
import ArchitectureServiceAmazonRedshift from "aws-react-icons/icons/ArchitectureServiceAmazonRedshift";
import ArchitectureServiceAmazonRekognition from "aws-react-icons/icons/ArchitectureServiceAmazonRekognition";
import ArchitectureServiceAmazonRoute53 from "aws-react-icons/icons/ArchitectureServiceAmazonRoute53";
import ArchitectureServiceAmazonSageMaker from "aws-react-icons/icons/ArchitectureServiceAmazonSageMaker";
import ArchitectureServiceAmazonSimpleNotificationService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleNotificationService";
import ArchitectureServiceAmazonSimpleQueueService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleQueueService";
import ArchitectureServiceAmazonSimpleStorageService from "aws-react-icons/icons/ArchitectureServiceAmazonSimpleStorageService";
import ArchitectureServiceAmazonTextract from "aws-react-icons/icons/ArchitectureServiceAmazonTextract";
import ArchitectureServiceAmazonTranscribe from "aws-react-icons/icons/ArchitectureServiceAmazonTranscribe";
import ArchitectureServiceAmazonTranslate from "aws-react-icons/icons/ArchitectureServiceAmazonTranslate";
import ArchitectureServiceAWSAppSync from "aws-react-icons/icons/ArchitectureServiceAWSAppSync";
import ArchitectureServiceAWSBackup from "aws-react-icons/icons/ArchitectureServiceAWSBackup";
import ArchitectureServiceAWSCloudFormation from "aws-react-icons/icons/ArchitectureServiceAWSCloudFormation";
import ArchitectureServiceAWSCloudTrail from "aws-react-icons/icons/ArchitectureServiceAWSCloudTrail";
import ArchitectureServiceAWSConfig from "aws-react-icons/icons/ArchitectureServiceAWSConfig";
import ArchitectureServiceAWSDatabaseMigrationService from "aws-react-icons/icons/ArchitectureServiceAWSDatabaseMigrationService";
import ArchitectureServiceAWSDirectConnect from "aws-react-icons/icons/ArchitectureServiceAWSDirectConnect";
import ArchitectureServiceAWSGlue from "aws-react-icons/icons/ArchitectureServiceAWSGlue";
import ArchitectureServiceAWSIAMIdentityCenter from "aws-react-icons/icons/ArchitectureServiceAWSIAMIdentityCenter";
import ArchitectureServiceAWSKeyManagementService from "aws-react-icons/icons/ArchitectureServiceAWSKeyManagementService";
import ArchitectureServiceAWSLambda from "aws-react-icons/icons/ArchitectureServiceAWSLambda";
import ArchitectureServiceAWSPrivateLink from "aws-react-icons/icons/ArchitectureServiceAWSPrivateLink";
import ArchitectureServiceAWSSecretsManager from "aws-react-icons/icons/ArchitectureServiceAWSSecretsManager";
import ArchitectureServiceAWSSecurityHub from "aws-react-icons/icons/ArchitectureServiceAWSSecurityHub";
import ArchitectureServiceAWSStepFunctions from "aws-react-icons/icons/ArchitectureServiceAWSStepFunctions";
import ArchitectureServiceAWSSystemsManager from "aws-react-icons/icons/ArchitectureServiceAWSSystemsManager";
import ArchitectureServiceAWSTransferFamily from "aws-react-icons/icons/ArchitectureServiceAWSTransferFamily";
import ArchitectureServiceAWSWAF from "aws-react-icons/icons/ArchitectureServiceAWSWAF";
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
  cloudfront: ArchitectureServiceAmazonCloudFront,
  route53: ArchitectureServiceAmazonRoute53,
  "api-gateway": ArchitectureServiceAmazonAPIGateway,
  cloudwatch: ArchitectureServiceAmazonCloudWatch,
  dynamodb: ArchitectureServiceAmazonDynamoDB,
  rds: ArchitectureServiceAmazonRDS,
  documentdb: ArchitectureServiceAmazonDocumentDB,
  neptune: ArchitectureServiceAmazonNeptune,
  opensearch: ArchitectureServiceAmazonOpenSearchService,
  redshift: ArchitectureServiceAmazonRedshift,
  emr: ArchitectureServiceAmazonEMR,
  msk: ArchitectureServiceAmazonManagedStreamingforApacheKafka,
  mq: ArchitectureServiceAmazonMQ,
  cognito: ArchitectureServiceAmazonCognito,
  appsync: ArchitectureServiceAWSAppSync,
  sagemaker: ArchitectureServiceAmazonSageMaker,
  rekognition: ArchitectureServiceAmazonRekognition,
  comprehend: ArchitectureServiceAmazonComprehend,
  translate: ArchitectureServiceAmazonTranslate,
  transcribe: ArchitectureServiceAmazonTranscribe,
  polly: ArchitectureServiceAmazonPolly,
  connect: ArchitectureServiceAmazonConnect,
  "iam-identity-center": ArchitectureServiceAWSIAMIdentityCenter,
  kms: ArchitectureServiceAWSKeyManagementService,
  "secrets-manager": ArchitectureServiceAWSSecretsManager,
  cloudformation: ArchitectureServiceAWSCloudFormation,
  cloudtrail: ArchitectureServiceAWSCloudTrail,
  config: ArchitectureServiceAWSConfig,
  "systems-manager": ArchitectureServiceAWSSystemsManager,
  guardduty: ArchitectureServiceAmazonGuardDuty,
  "security-hub": ArchitectureServiceAWSSecurityHub,
  waf: ArchitectureServiceAWSWAF,
  "direct-connect": ArchitectureServiceAWSDirectConnect,
  privatelink: ArchitectureServiceAWSPrivateLink,
};
