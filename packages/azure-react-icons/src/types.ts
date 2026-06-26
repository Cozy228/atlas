import type * as React from "react";

export interface AzureIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export interface AzureIconMetadata {
  componentName: string;
  category: string;
  serviceName: string;
  sourcePath: string;
}
