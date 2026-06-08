import { useEffect, useState, type ComponentType } from "react";

import { cn } from "@/lib/utils";

export type ServiceIconSize = "sm" | "base" | "md" | "lg" | "xl" | "hero";
export type ServiceIconComponent = ComponentType<{ size?: number | string }>;
export type ServiceIconMap = Record<string, ServiceIconComponent>;

type MappedServiceIconProps = {
  serviceId: string;
  iconMap: ServiceIconMap;
  size?: ServiceIconSize;
};

const sizeClass = {
  sm: "size-5",
  base: "size-6",
  md: "size-[30px]",
  lg: "size-9",
  xl: "size-12",
  hero: "size-16",
} as const;

const iconSize = {
  sm: 18,
  base: 20,
  md: 22,
  lg: 28,
  xl: 38,
  hero: 52,
} as const;

const fallbackClass = {
  sm: "type-icon-glyph",
  base: "type-caption",
  md: "text-xs",
  lg: "text-xs",
  xl: "type-detail",
  hero: "type-body",
} as const;

/**
 * Brand SVGs are detailed; mounting dozens in a single commit janks weak CPUs on the
 * first paint of each provider tab. Render the cheap glyph first, then upgrade to the
 * real icon during idle time so the initial commit stays light. Per-mount state means
 * every tab's first render (rows remount on provider switch) gets the same deferral.
 */
function useDeferredIconMount() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true));
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  return ready;
}

export function MappedServiceIcon({ serviceId, iconMap, size = "md" }: MappedServiceIconProps) {
  const ready = useDeferredIconMount();
  const ResolvedIcon = ready ? iconMap[serviceId] : undefined;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        ResolvedIcon ? "bg-transparent" : "bg-brand-tint",
        sizeClass[size],
      )}
    >
      {ResolvedIcon ? (
        <ResolvedIcon size={iconSize[size]} />
      ) : (
        <ServiceIconGlyph serviceId={serviceId} size={size} />
      )}
    </span>
  );
}

export function ServiceIconFallback({
  serviceId,
  size = "md",
}: {
  serviceId: string;
  size?: ServiceIconSize;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-brand-tint",
        sizeClass[size],
      )}
    >
      <ServiceIconGlyph serviceId={serviceId} size={size} />
    </span>
  );
}

function ServiceIconGlyph({
  serviceId,
  size = "md",
}: {
  serviceId: string;
  size?: ServiceIconSize;
}) {
  return (
    <span className={cn("font-mono font-bold uppercase text-primary", fallbackClass[size])}>
      {serviceId.charAt(0)}
    </span>
  );
}
