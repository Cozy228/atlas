import { lazy, Suspense } from "react";

import { AWS_ICON_MAP } from "@/lib/aws-icon-map";
import {
  MappedServiceIcon,
  ServiceIconFallback,
  type ServiceIconSize,
} from "@/components/explore/service-icon-frame";

type ServiceIconProps = {
  serviceId: string;
  provider?: ServiceIconProvider;
  size?: ServiceIconSize;
};

export type ServiceIconProvider = "aws" | "azure";

let azureServiceIconModule: Promise<typeof import("./azure-service-icon")> | null = null;

function loadAzureServiceIconModule() {
  azureServiceIconModule ??= import("./azure-service-icon");
  return azureServiceIconModule;
}

const AzureServiceIcon = lazy(() =>
  loadAzureServiceIconModule().then((module) => ({ default: module.AzureServiceIcon })),
);

export function preloadAzureServiceIcons() {
  void loadAzureServiceIconModule();
}

export function ServiceIcon({ serviceId, provider = "aws", size = "md" }: ServiceIconProps) {
  if (provider === "azure") {
    return (
      <Suspense fallback={<ServiceIconFallback serviceId={serviceId} size={size} />}>
        <AzureServiceIcon serviceId={serviceId} size={size} />
      </Suspense>
    );
  }

  return <MappedServiceIcon serviceId={serviceId} iconMap={AWS_ICON_MAP} size={size} />;
}
