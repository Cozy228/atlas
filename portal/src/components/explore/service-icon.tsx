import { AWS_ICON_MAP } from "@/lib/aws-icon-map";
import { cn } from "@/lib/utils";

type ServiceIconProps = {
  serviceId: string;
  size?: "sm" | "base" | "md" | "lg" | "xl" | "hero";
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
  sm: "text-[7px]",
  base: "text-[9px]",
  md: "text-[11px]",
  lg: "text-[12px]",
  xl: "text-[13px]",
  hero: "text-[16px]",
} as const;

export function ServiceIcon({ serviceId, size = "md" }: ServiceIconProps) {
  const Icon = AWS_ICON_MAP[serviceId];

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        Icon ? "bg-transparent" : "bg-brand-tint",
        sizeClass[size],
      )}
    >
      {Icon ? (
        <Icon size={iconSize[size]} />
      ) : (
        <span className={cn("font-mono font-bold uppercase text-primary", fallbackClass[size])}>
          {serviceId.charAt(0)}
        </span>
      )}
    </span>
  );
}
