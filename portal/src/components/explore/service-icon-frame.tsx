import { type ComponentType } from "react";

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
 * Renders the real brand SVG directly. The matrix preloads the active provider's
 * icon pack at the route loader and defers its own mount by one paint (see
 * `availability.index.tsx`), so by the time these icons mount the map is already
 * resolved and each one commits exactly once — no per-icon idle-callback upgrade
 * pass. Falls back to a cheap monogram glyph when a service has no mapped icon.
 */
export function MappedServiceIcon({ serviceId, iconMap, size = "md" }: MappedServiceIconProps) {
  const ResolvedIcon = iconMap[serviceId];

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
