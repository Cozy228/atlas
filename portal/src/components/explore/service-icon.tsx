import { lazy, Suspense } from "react";

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

type ProviderIconProps = {
  serviceId: string;
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

// The AWS icon pack (~36 KB gzip) is split off the same way as Azure: detail
// routes that render a single AWS ServiceIcon no longer pull the whole pack into
// their eager chunk — it loads on demand, and the availability matrix preloads
// it (see `preloadAwsServiceIcons`) so its first paint keeps the real icons.
let awsIconMapModule: Promise<typeof import("@/lib/aws-icon-map")> | null = null;

function loadAwsIconMapModule() {
  awsIconMapModule ??= import("@/lib/aws-icon-map");
  return awsIconMapModule;
}

const AwsServiceIcon = lazy(() =>
  loadAwsIconMapModule().then((module) => ({
    default: ({ serviceId, size }: ProviderIconProps) => (
      <MappedServiceIcon serviceId={serviceId} iconMap={module.AWS_ICON_MAP} size={size} />
    ),
  })),
);

export function preloadAwsServiceIcons() {
  void loadAwsIconMapModule();
}

export function ServiceIcon({ serviceId, provider = "aws", size = "md" }: ServiceIconProps) {
  const ProviderIcon = provider === "azure" ? AzureServiceIcon : AwsServiceIcon;
  return (
    <Suspense fallback={<ServiceIconFallback serviceId={serviceId} size={size} />}>
      <ProviderIcon serviceId={serviceId} size={size} />
    </Suspense>
  );
}
