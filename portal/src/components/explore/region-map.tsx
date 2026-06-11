import { useState } from "react";
import { IconMinus, IconPlus } from "@tabler/icons-react";

import type { Location } from "@/api/server/availability";
import { cn } from "@/lib/utils";
import { WORLD_MAP, projectWorld } from "./world-geo";

/** Operational health used to colour a region marker. */
export type RegionHealth = "operational" | "maintenance" | "degraded" | "expanding";

/** Marker fill per health state. Theme-aware via CSS custom properties. */
const HEALTH_FILL: Record<RegionHealth, string> = {
  operational: "var(--color-success)",
  maintenance: "var(--color-warning)",
  degraded: "var(--color-critical)",
  expanding: "var(--color-brand)",
};

const ZOOM_STEP = 0.6;
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.4;

type RegionMapProps = {
  locations: ReadonlyArray<Location>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  healthById: ReadonlyMap<string, RegionHealth>;
  zoneName: string;
  className?: string;
};

export function RegionMap({
  locations,
  selectedId,
  onSelect,
  healthById,
  zoneName,
  className,
}: RegionMapProps) {
  const [zoom, setZoom] = useState(ZOOM_MIN);

  const pinned = locations.filter((l) => l.coordinates);
  const selected = pinned.find((l) => l.id === selectedId) ?? null;

  // Zoom anchors on the selected marker so selecting + zooming focuses a region.
  const [focusX, focusY] = selected?.coordinates
    ? projectWorld(selected.coordinates[0], selected.coordinates[1])
    : [WORLD_MAP.width / 2, WORLD_MAP.height / 2];
  const sceneTransform =
    zoom === 1 ? undefined : `translate(${focusX} ${focusY}) scale(${zoom}) translate(${-focusX} ${-focusY})`;

  // Draw the selected marker last so its halo and label sit above the others.
  const ordered = selected ? [...pinned.filter((l) => l.id !== selected.id), selected] : pinned;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${WORLD_MAP.width} ${WORLD_MAP.height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Map of ${zoneName} regions`}
      >
        <defs>
          <filter id="region-pin-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.2" />
          </filter>
          <radialGradient id="region-ocean" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="var(--color-brand-tint)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-card)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={WORLD_MAP.width} height={WORLD_MAP.height} fill="url(#region-ocean)" />

        <g transform={sceneTransform}>
          <path
            d={WORLD_MAP.land}
            fill="var(--color-border)"
            stroke="var(--color-border-strong)"
            strokeWidth={0.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {ordered.map((location) => {
            const [x, y] = projectWorld(location.coordinates![0], location.coordinates![1]);
            const health = healthById.get(location.id) ?? "operational";
            const active = location.id === selectedId;
            return (
              <Marker
                key={location.id}
                x={x}
                y={y}
                label={regionLabel(location)}
                fill={HEALTH_FILL[health]}
                active={active}
                onSelect={() => onSelect(location.id)}
              />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-card/85 px-2.5 py-1.5 shadow-sm backdrop-blur">
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Active network
        </p>
        <p className="mt-0.5 text-[13px] font-bold tracking-[-0.01em] text-foreground">{zoneName}</p>
      </div>

      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-border bg-card/90 shadow-sm backdrop-blur">
        <ZoomButton
          label="Zoom in"
          disabled={zoom >= ZOOM_MAX}
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
        >
          <IconPlus className="size-4" aria-hidden />
        </ZoomButton>
        <span aria-hidden className="h-px bg-border" />
        <ZoomButton
          label="Zoom out"
          disabled={zoom <= ZOOM_MIN}
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
        >
          <IconMinus className="size-4" aria-hidden />
        </ZoomButton>
      </div>
    </section>
  );
}

function Marker({
  x,
  y,
  label,
  fill,
  active,
  onSelect,
}: {
  x: number;
  y: number;
  label: string;
  fill: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={active}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="group cursor-pointer outline-none"
    >
      {/* Teardrop map pin: head centred at y=-15, tip at the origin (the exact
          projected coordinate). Active pins scale up from the tip. */}
      <g transform={active ? "scale(1.18)" : undefined}>
        <path
          d="M0 0 C -4 -6 -9 -9 -9 -15 a 9 9 0 1 1 18 0 C 9 -9 4 -6 0 0 Z"
          fill={fill}
          stroke="var(--color-card)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          filter="url(#region-pin-shadow)"
        />
        <circle cx={0} cy={-15} r={3.2} fill="var(--color-card)" />
      </g>
      {active ? (
        /* Selection halo, drawn OVER the pin: a brand ring that keeps
           expanding outward from the pin head. */
        <circle
          cy={-15}
          r={17}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={2.5}
          opacity={0.7}
          className="animate-ping motion-reduce:animate-none"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      ) : null}
      <text
        y={14}
        textAnchor="middle"
        paintOrder="stroke"
        stroke="var(--color-card)"
        strokeWidth={3}
        strokeLinejoin="round"
        className={cn(
          "fill-foreground text-[10px] font-semibold transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        {label}
      </text>
    </g>
  );
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {children}
    </button>
  );
}

/** Region label with the engineering hyphens softened to spaces. */
export function regionLabel(location: Location): string {
  return location.label.replace(/-/g, " ");
}
