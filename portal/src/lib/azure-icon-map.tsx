import AzureAIMachineLearningAzureOpenAI from "azure-react-icons/icons/AzureAIMachineLearningAzureOpenAI";
import AzureAIMachineLearningCognitiveServices from "azure-react-icons/icons/AzureAIMachineLearningCognitiveServices";
import AzureAnalyticsAzureDatabricks from "azure-react-icons/icons/AzureAnalyticsAzureDatabricks";
import AzureAnalyticsAzureSynapseAnalytics from "azure-react-icons/icons/AzureAnalyticsAzureSynapseAnalytics";
import AzureAnalyticsDataFactories from "azure-react-icons/icons/AzureAnalyticsDataFactories";
import AzureAnalyticsEventHubs from "azure-react-icons/icons/AzureAnalyticsEventHubs";
import AzureAnalyticsLogAnalyticsWorkspaces from "azure-react-icons/icons/AzureAnalyticsLogAnalyticsWorkspaces";
import AzureAnalyticsPowerBiEmbedded from "azure-react-icons/icons/AzureAnalyticsPowerBiEmbedded";
import AzureAnalyticsStreamAnalyticsJobs from "azure-react-icons/icons/AzureAnalyticsStreamAnalyticsJobs";
import AzureAppServicesAppServices from "azure-react-icons/icons/AzureAppServicesAppServices";
import AzureAppServicesCDNProfiles from "azure-react-icons/icons/AzureAppServicesCDNProfiles";
import AzureComputeBatchAccounts from "azure-react-icons/icons/AzureComputeBatchAccounts";
import AzureComputeDisks from "azure-react-icons/icons/AzureComputeDisks";
import AzureComputeFunctionApps from "azure-react-icons/icons/AzureComputeFunctionApps";
import AzureComputeVMScaleSets from "azure-react-icons/icons/AzureComputeVMScaleSets";
import AzureComputeVirtualMachine from "azure-react-icons/icons/AzureComputeVirtualMachine";
import AzureContainersContainerInstances from "azure-react-icons/icons/AzureContainersContainerInstances";
import AzureContainersContainerRegistries from "azure-react-icons/icons/AzureContainersContainerRegistries";
import AzureContainersKubernetesServices from "azure-react-icons/icons/AzureContainersKubernetesServices";
import AzureDatabasesAzureCosmosDB from "azure-react-icons/icons/AzureDatabasesAzureCosmosDB";
import AzureDatabasesAzureDatabaseMigrationServices from "azure-react-icons/icons/AzureDatabasesAzureDatabaseMigrationServices";
import AzureDatabasesAzureDatabaseMysqlServer from "azure-react-icons/icons/AzureDatabasesAzureDatabaseMysqlServer";
import AzureDatabasesAzureDatabasePostgresqlServer from "azure-react-icons/icons/AzureDatabasesAzureDatabasePostgresqlServer";
import AzureDatabasesAzureSQL from "azure-react-icons/icons/AzureDatabasesAzureSQL";
import AzureDatabasesCacheRedis from "azure-react-icons/icons/AzureDatabasesCacheRedis";
import AzureDevopsApplicationInsights from "azure-react-icons/icons/AzureDevopsApplicationInsights";
import AzureDevopsAzureDevops from "azure-react-icons/icons/AzureDevopsAzureDevops";
import AzureIdentityEnterpriseApplications from "azure-react-icons/icons/AzureIdentityEnterpriseApplications";
import AzureIdentityManagedIdentities from "azure-react-icons/icons/AzureIdentityManagedIdentities";
import AzureIntegrationAPIManagementServices from "azure-react-icons/icons/AzureIntegrationAPIManagementServices";
import AzureIntegrationAzureServiceBus from "azure-react-icons/icons/AzureIntegrationAzureServiceBus";
import AzureIntegrationEventGridTopics from "azure-react-icons/icons/AzureIntegrationEventGridTopics";
import AzureIntegrationLogicApps from "azure-react-icons/icons/AzureIntegrationLogicApps";
import AzureManagementGovernanceAdvisor from "azure-react-icons/icons/AzureManagementGovernanceAdvisor";
import AzureManagementGovernanceAutomationAccounts from "azure-react-icons/icons/AzureManagementGovernanceAutomationAccounts";
import AzureManagementGovernancePolicy from "azure-react-icons/icons/AzureManagementGovernancePolicy";
import AzureNetworkingApplicationGateways from "azure-react-icons/icons/AzureNetworkingApplicationGateways";
import AzureNetworkingBastions from "azure-react-icons/icons/AzureNetworkingBastions";
import AzureNetworkingDNSZones from "azure-react-icons/icons/AzureNetworkingDNSZones";
import AzureNetworkingFirewalls from "azure-react-icons/icons/AzureNetworkingFirewalls";
import AzureNetworkingFrontDoorAndCDNProfiles from "azure-react-icons/icons/AzureNetworkingFrontDoorAndCDNProfiles";
import AzureNetworkingLoadBalancers from "azure-react-icons/icons/AzureNetworkingLoadBalancers";
import AzureNetworkingPrivateLink from "azure-react-icons/icons/AzureNetworkingPrivateLink";
import AzureNetworkingVirtualNetworks from "azure-react-icons/icons/AzureNetworkingVirtualNetworks";
import AzureNetworkingVirtualWans from "azure-react-icons/icons/AzureNetworkingVirtualWans";
import AzureOtherAzureMonitorDashboard from "azure-react-icons/icons/AzureOtherAzureMonitorDashboard";
import AzureSecurityAzureSentinel from "azure-react-icons/icons/AzureSecurityAzureSentinel";
import AzureSecurityKeyVaults from "azure-react-icons/icons/AzureSecurityKeyVaults";
import AzureSecurityMicrosoftDefenderForCloud from "azure-react-icons/icons/AzureSecurityMicrosoftDefenderForCloud";
import AzureStorageAzureFileshares from "azure-react-icons/icons/AzureStorageAzureFileshares";
import AzureStorageDataLakeStorageGen1 from "azure-react-icons/icons/AzureStorageDataLakeStorageGen1";
import AzureStorageRecoveryServicesVaults from "azure-react-icons/icons/AzureStorageRecoveryServicesVaults";
import AzureStorageStorageAccounts from "azure-react-icons/icons/AzureStorageStorageAccounts";
import AzureWebSignalR from "azure-react-icons/icons/AzureWebSignalR";
import AzureWebStaticApps from "azure-react-icons/icons/AzureWebStaticApps";
import type { ComponentType } from "react";

type AzureIconComponent = ComponentType<{ size?: number | string }>;

export const AZURE_ICON_MAP: Readonly<Record<string, AzureIconComponent>> = {
  vm: AzureComputeVirtualMachine,
  "app-service": AzureAppServicesAppServices,
  functions: AzureComputeFunctionApps,
  "container-instances": AzureContainersContainerInstances,
  aks: AzureContainersKubernetesServices,
  batch: AzureComputeBatchAccounts,
  "blob-storage": AzureStorageStorageAccounts,
  "file-storage": AzureStorageAzureFileshares,
  "disk-storage": AzureComputeDisks,
  "data-lake": AzureStorageDataLakeStorageGen1,
  "azure-sql": AzureDatabasesAzureSQL,
  "cosmos-db": AzureDatabasesAzureCosmosDB,
  "pg-flexible": AzureDatabasesAzureDatabasePostgresqlServer,
  "redis-cache": AzureDatabasesCacheRedis,
  vnet: AzureNetworkingVirtualNetworks,
  "load-balancer": AzureNetworkingLoadBalancers,
  "app-gateway": AzureNetworkingApplicationGateways,
  "front-door": AzureNetworkingFrontDoorAndCDNProfiles,
  synapse: AzureAnalyticsAzureSynapseAnalytics,
  "data-factory": AzureAnalyticsDataFactories,
  databricks: AzureAnalyticsAzureDatabricks,
  "stream-analytics": AzureAnalyticsStreamAnalyticsJobs,
  "service-bus": AzureIntegrationAzureServiceBus,
  "event-grid": AzureIntegrationEventGridTopics,
  "logic-apps": AzureIntegrationLogicApps,
  "api-management": AzureIntegrationAPIManagementServices,
  "azure-openai": AzureAIMachineLearningAzureOpenAI,
  "cognitive-services": AzureAIMachineLearningCognitiveServices,
  "key-vault": AzureSecurityKeyVaults,
  sentinel: AzureSecurityAzureSentinel,
  "vm-scale-sets": AzureComputeVMScaleSets,
  "container-registry": AzureContainersContainerRegistries,
  cdn: AzureAppServicesCDNProfiles,
  "static-web-apps": AzureWebStaticApps,
  signalr: AzureWebSignalR,
  "event-hubs": AzureAnalyticsEventHubs,
  "log-analytics": AzureAnalyticsLogAnalyticsWorkspaces,
  "power-bi": AzureAnalyticsPowerBiEmbedded,
  "application-insights": AzureDevopsApplicationInsights,
  "mysql-flexible": AzureDatabasesAzureDatabaseMysqlServer,
  "database-migration": AzureDatabasesAzureDatabaseMigrationServices,
  "entra-id": AzureIdentityEnterpriseApplications,
  "managed-identities": AzureIdentityManagedIdentities,
  "azure-devops": AzureDevopsAzureDevops,
  automation: AzureManagementGovernanceAutomationAccounts,
  policy: AzureManagementGovernancePolicy,
  advisor: AzureManagementGovernanceAdvisor,
  firewall: AzureNetworkingFirewalls,
  bastion: AzureNetworkingBastions,
  "private-link": AzureNetworkingPrivateLink,
  "dns-zones": AzureNetworkingDNSZones,
  "virtual-wan": AzureNetworkingVirtualWans,
  "recovery-services": AzureStorageRecoveryServicesVaults,
  "defender-cloud": AzureSecurityMicrosoftDefenderForCloud,
  monitor: AzureOtherAzureMonitorDashboard,
};
