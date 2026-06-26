import { describe, expect, it } from "vitest";
import { AZURE_ICON_MAP } from "./azure-icon-map";

const azureServiceIds = [
  "vm",
  "app-service",
  "functions",
  "container-instances",
  "aks",
  "batch",
  "blob-storage",
  "file-storage",
  "disk-storage",
  "data-lake",
  "azure-sql",
  "cosmos-db",
  "pg-flexible",
  "redis-cache",
  "vnet",
  "load-balancer",
  "app-gateway",
  "front-door",
  "synapse",
  "data-factory",
  "databricks",
  "stream-analytics",
  "service-bus",
  "event-grid",
  "logic-apps",
  "api-management",
  "azure-openai",
  "cognitive-services",
  "key-vault",
  "sentinel",
  "vm-scale-sets",
  "container-registry",
  "cdn",
  "static-web-apps",
  "signalr",
  "event-hubs",
  "log-analytics",
  "power-bi",
  "application-insights",
  "mysql-flexible",
  "database-migration",
  "entra-id",
  "managed-identities",
  "azure-devops",
  "automation",
  "policy",
  "advisor",
  "firewall",
  "bastion",
  "private-link",
  "dns-zones",
  "virtual-wan",
  "recovery-services",
  "defender-cloud",
  "monitor",
] as const;

describe("AZURE_ICON_MAP", () => {
  it("maps every Azure availability service id to an icon component", () => {
    for (const serviceId of azureServiceIds) {
      expect(AZURE_ICON_MAP[serviceId], serviceId).toBeTypeOf("function");
    }
  });
});
