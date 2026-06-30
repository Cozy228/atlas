import { IconCircleOff } from "@tabler/icons-react";

/**
 * Per-LZ honest dead-end (ADR-0006, plan 021 G3): a registered landing zone with
 * no wired availability source shows THIS — never another landing zone's data,
 * never a fabricated empty grid presented as real.
 */
export function DataNotAvailableForZone({
  zoneName,
  surface,
}: {
  zoneName: string;
  surface: string;
}) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <IconCircleOff size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="type-heading font-semibold tracking-[-0.02em] text-foreground">
          No {surface} data for {zoneName}
        </h2>
        <p className="text-sm leading-[1.6] text-muted-foreground">
          The <span className="font-medium text-foreground">{zoneName}</span> landing zone is a
          registered target, but its availability source is not yet wired. Cloud DevEx Portal shows
          nothing here rather than another landing zone&rsquo;s data — switch to a wired landing
          zone, or contact the platform team to onboard this one.
        </p>
      </div>
    </div>
  );
}
