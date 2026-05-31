import { AZURE_ICON_MAP } from "@/lib/azure-icon-map";
import { MappedServiceIcon, type ServiceIconSize } from "@/components/explore/service-icon-frame";

type AzureServiceIconProps = {
  serviceId: string;
  size?: ServiceIconSize;
};

export function AzureServiceIcon({ serviceId, size = "md" }: AzureServiceIconProps) {
  return <MappedServiceIcon serviceId={serviceId} iconMap={AZURE_ICON_MAP} size={size} />;
}
