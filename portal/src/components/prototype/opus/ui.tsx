/**
 * Prototype `opus` — surface primitives
 * =====================================
 * The shared vocabulary for all four surfaces. Two ideas carry the design:
 *
 * 1. `ProvenanceMark` — every value is stamped with how Atlas knows it (letter
 *    tile, never colour alone), and the stamp is the button that opens the
 *    evidence behind it. Nothing is asserted without a way to check it.
 * 2. `Handoff` — wherever Atlas hands work to a source system, the boundary is
 *    drawn: what Atlas does, who executes, what Atlas watches afterwards.
 *
 * Panels, rows and chips are deliberately plain so those two devices carry the
 * meaning. No component here nests a card inside a card.
 */
import type { ComponentProps, ReactNode } from "react";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconCheck,
  IconCircle,
  IconCircleCheck,
  IconCircleMinus,
  IconClockPause,
  IconExternalLink,
  IconInfoCircle,
  IconLoader2,
  IconLockExclamation,
  IconMinus,
  IconServer2,
  IconUser,
  IconUsers,
  IconUsersGroup,
  IconWriting,
} from "@tabler/icons-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { ago, elapsed, stamp } from "./fixtures/clock";
import { systemLabel } from "./fixtures/systems";
import type {
  Evidence,
  EvidenceRef,
  Fact,
  Freshness,
  Holder,
  Provenance,
  StepState,
} from "./fixtures/types";

/* ------------------------------------------------------------------ layout */

export function PageHeader({
  title,
  lead,
  aside,
}: {
  title: string;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 max-w-[68ch]">
        <h1 className="text-[19px] font-semibold leading-[1.25] tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {lead === undefined ? null : (
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">{lead}</p>
        )}
      </div>
      {aside === undefined ? null : <div className="shrink-0">{aside}</div>}
    </header>
  );
}

export function Panel({
  title,
  note,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn("min-w-0 overflow-hidden rounded-lg border border-border bg-card", className)}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border bg-[var(--proto-chrome)] px-3.5 py-2.5">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {note === undefined ? null : (
          <p className="min-w-0 flex-1 text-[12px] leading-[1.45] text-muted-foreground">{note}</p>
        )}
        {actions === undefined ? null : (
          <div className="ml-auto flex items-center gap-1.5">{actions}</div>
        )}
      </header>
      <div className={cn("min-w-0", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Column heading type. Used for table headers only, never as a section eyebrow. */
export function ColumnLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Well({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-border bg-[var(--proto-inset)] px-3 py-2.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Id({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("proto-id break-all text-foreground", className)}>{children}</span>;
}

/** Teaching empty state: says what would appear here and what to do meanwhile. */
export function EmptyState({
  title,
  body,
  hint,
  action,
}: {
  title: string;
  body: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-3.5 py-8">
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      <p className="max-w-[62ch] text-[13px] leading-[1.55] text-muted-foreground">{body}</p>
      {hint === undefined ? null : (
        <p className="max-w-[62ch] text-[12px] leading-[1.5] text-muted-foreground">{hint}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- provenance */

const PROVENANCE_MARK: Readonly<Record<Provenance, string>> = {
  observed: "O",
  derived: "D",
  declared: "S",
  atlas: "A",
  unknown: "?",
};

const PROVENANCE_TITLE: Readonly<Record<Provenance, string>> = {
  observed: "Observed",
  derived: "Derived",
  declared: "Stated",
  atlas: "Atlas-owned",
  unknown: "Unknown",
};

const PROVENANCE_MEANING: Readonly<Record<Provenance, string>> = {
  observed: "Read from a source system.",
  derived: "Computed by Atlas from observed facts.",
  declared: "Asserted by a person. Nothing verifies it.",
  atlas: "Atlas' own experience state. No source system holds it.",
  unknown: "Source unreachable, unmapped, or not permitted.",
};

export function provenanceTitle(provenance: Provenance): string {
  return PROVENANCE_TITLE[provenance];
}

/** The letter tile. Shape and letter carry the meaning; colour is not used. */
export function ProvenanceMark({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold leading-none",
        provenance === "unknown"
          ? "border border-dashed border-[var(--proto-void)] text-[var(--proto-void-ink)]"
          : "bg-[var(--proto-mark-bg)] text-[var(--proto-mark-ink)]",
        className,
      )}
    >
      {PROVENANCE_MARK[provenance]}
    </span>
  );
}

export function ProvenanceLegend({ className }: { className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-1.5", className)}>
      {(Object.keys(PROVENANCE_MARK) as ReadonlyArray<Provenance>).map((provenance) => (
        <div key={provenance} className="flex items-center gap-2">
          <dt className="flex items-center gap-1.5">
            <ProvenanceMark provenance={provenance} />
            <span className="sr-only">{PROVENANCE_TITLE[provenance]}</span>
          </dt>
          <dd className="text-[11px] leading-[1.35] text-muted-foreground">
            {PROVENANCE_TITLE[provenance]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const FRESHNESS_NOTE: Readonly<Record<Freshness, string>> = {
  fresh: "Current",
  aging: "Refreshed on a slower cycle than this page",
  stale: "Older than its refresh contract",
  unknown: "Freshness cannot be established",
};

type EvidenceDetail = {
  provenance: Provenance;
  systemId?: string;
  externalId?: string;
  retrievedAt?: string;
  freshness?: Freshness;
  method?: string;
  caveat?: string;
  declaredBy?: string;
};

/**
 * The provenance mark, as a button that opens the evidence behind the value.
 * Every fact on every surface gets one; it is the prototype's citation.
 */
export function EvidenceButton({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: EvidenceDetail;
  className?: string;
}) {
  const hasDetail =
    detail.systemId !== undefined ||
    detail.method !== undefined ||
    detail.retrievedAt !== undefined ||
    detail.caveat !== undefined ||
    detail.declaredBy !== undefined;

  if (!hasDetail) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={cn("inline-flex", className)}>
              <ProvenanceMark provenance={detail.provenance} />
            </span>
          }
        />
        <TooltipContent>
          {PROVENANCE_TITLE[detail.provenance]} · {PROVENANCE_MEANING[detail.provenance]}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`How Atlas knows ${label}: ${PROVENANCE_TITLE[detail.provenance]}`}
            className={cn(
              "inline-flex rounded-[3px] transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              className,
            )}
          >
            <ProvenanceMark provenance={detail.provenance} />
          </button>
        }
      />
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <ProvenanceMark provenance={detail.provenance} />
            {PROVENANCE_TITLE[detail.provenance]}
          </p>
          <p className="mt-1 text-[13px] font-semibold leading-[1.4] text-foreground">{label}</p>
          <p className="mt-0.5 break-words text-[12px] leading-[1.45] text-muted-foreground">
            {value}
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 px-3 py-2.5 text-[12px]">
          <dt className="text-muted-foreground">Meaning</dt>
          <dd className="text-foreground">{PROVENANCE_MEANING[detail.provenance]}</dd>
          {detail.systemId === undefined ? null : (
            <>
              <dt className="text-muted-foreground">System</dt>
              <dd className="text-foreground">{systemLabel(detail.systemId)}</dd>
            </>
          )}
          {detail.externalId === undefined ? null : (
            <>
              <dt className="text-muted-foreground">Record</dt>
              <dd>
                <Id>{detail.externalId}</Id>
              </dd>
            </>
          )}
          {detail.declaredBy === undefined ? null : (
            <>
              <dt className="text-muted-foreground">Stated by</dt>
              <dd className="text-foreground">{detail.declaredBy}</dd>
            </>
          )}
          {detail.retrievedAt === undefined ? null : (
            <>
              <dt className="text-muted-foreground">Retrieved</dt>
              <dd className="proto-num text-foreground">
                {ago(detail.retrievedAt)}
                <span className="block text-[11px] text-muted-foreground">
                  {stamp(detail.retrievedAt)}
                </span>
              </dd>
            </>
          )}
          {detail.freshness === undefined ? null : (
            <>
              <dt className="text-muted-foreground">Freshness</dt>
              <dd className="text-foreground">{FRESHNESS_NOTE[detail.freshness]}</dd>
            </>
          )}
          {detail.method === undefined ? null : (
            <>
              <dt className="text-muted-foreground">How</dt>
              <dd className="text-foreground">{detail.method}</dd>
            </>
          )}
        </dl>
        {detail.caveat === undefined ? null : (
          <p className="border-t border-border bg-[var(--proto-tint-wait)] px-3 py-2 text-[12px] leading-[1.45] text-[var(--warning-ink)]">
            {detail.caveat}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Label / value / provenance, the row shape used by every context ledger. */
export function FactRow({ fact }: { fact: Fact }) {
  return (
    <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 border-b border-[var(--proto-hairline)] px-3.5 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
      <dt className="min-w-0 text-[12px] leading-[1.45] text-muted-foreground">{fact.label}</dt>
      <dd className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "min-w-0 break-words text-[13px] leading-[1.45]",
            fact.provenance === "unknown"
              ? "text-[var(--proto-void-ink)]"
              : "font-medium text-foreground",
            fact.mono === true ? "proto-id" : undefined,
          )}
        >
          {fact.value}
        </span>
        <EvidenceButton
          label={fact.label}
          value={fact.value}
          detail={fact}
          className="translate-y-[1px]"
        />
        {fact.caveat === undefined ? null : (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex translate-y-[2px] text-[var(--warning-ink)]">
                  <IconInfoCircle size={13} aria-hidden />
                  <span className="sr-only">Data-quality note</span>
                </span>
              }
            />
            <TooltipContent>{fact.caveat}</TooltipContent>
          </Tooltip>
        )}
      </dd>
    </div>
  );
}

/** A recorded piece of completion evidence. */
export function EvidenceRow({ evidence }: { evidence: Evidence | EvidenceRef }) {
  const recordedAt = "recordedAt" in evidence ? evidence.recordedAt : evidence.retrievedAt;
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <EvidenceButton
        label={evidence.label}
        value={evidence.value}
        detail={{
          provenance: evidence.provenance,
          systemId: evidence.systemId,
          retrievedAt: recordedAt,
        }}
        className="translate-y-[2px]"
      />
      <span className="text-[12px] text-muted-foreground">{evidence.label}</span>
      <span
        className={cn(
          "min-w-0 break-words text-[13px] font-medium text-foreground",
          evidence.mono === true ? "proto-id" : undefined,
        )}
      >
        {evidence.value}
      </span>
      <span className="proto-num ml-auto shrink-0 text-[11px] text-muted-foreground">
        {ago(recordedAt)}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------- state */

type StateStyle = {
  label: string;
  icon: typeof IconCheck;
  className: string;
  pulse?: boolean;
};

const STATE_STYLE: Readonly<Record<StepState, StateStyle>> = {
  verified: {
    label: "Verified",
    icon: IconCircleCheck,
    className: "border-[var(--success)]/45 bg-[var(--proto-tint-ok)] text-[var(--success-ink)]",
  },
  confirmed: {
    label: "Stated",
    icon: IconWriting,
    className: "border-[var(--success)]/35 bg-transparent text-[var(--success-ink)]",
  },
  running: {
    label: "Running",
    icon: IconLoader2,
    className: "border-brand/45 bg-brand-tint text-brand-ink",
    pulse: true,
  },
  ready: {
    label: "Ready",
    icon: IconArrowNarrowRight,
    className: "border-brand/40 bg-transparent text-brand-ink",
  },
  waiting: {
    label: "Waiting",
    icon: IconClockPause,
    className: "border-[var(--warning)]/55 bg-[var(--proto-tint-wait)] text-[var(--warning-ink)]",
  },
  blocked: {
    label: "Blocked",
    icon: IconLockExclamation,
    className:
      "border-dashed border-[var(--critical)]/55 bg-transparent text-[var(--critical-ink)]",
  },
  failed: {
    label: "Failed",
    icon: IconAlertTriangle,
    className: "border-[var(--critical)]/50 bg-[var(--proto-tint-stop)] text-[var(--critical-ink)]",
  },
  waived: {
    label: "Waived",
    icon: IconCircleMinus,
    className:
      "border-dashed border-[var(--proto-void)] bg-transparent text-[var(--proto-void-ink)]",
  },
  "off-branch": {
    label: "Not on this branch",
    icon: IconMinus,
    className:
      "border-dashed border-[var(--proto-void)] bg-transparent text-[var(--proto-void-ink)]",
  },
  "not-started": {
    label: "Not started",
    icon: IconCircle,
    className: "border-border bg-transparent text-muted-foreground",
  },
};

export function stateLabel(state: StepState): string {
  return STATE_STYLE[state].label;
}

/** Icon plus word. Colour is never the only carrier. */
export function StateChip({
  state,
  className,
  label,
}: {
  state: StepState;
  className?: string;
  label?: string;
}) {
  const style = STATE_STYLE[state];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 text-[11.5px] font-semibold",
        style.className,
        className,
      )}
    >
      <Icon size={12} aria-hidden className={style.pulse === true ? "proto-pulse" : undefined} />
      {label ?? style.label}
    </span>
  );
}

const HOLDER_ICON = {
  you: IconUser,
  "your-team": IconUsers,
  "other-team": IconUsersGroup,
  system: IconServer2,
} as const;

/** Who is holding this, and for how long. The wait is always visible. */
export function HolderChip({ holder, className }: { holder: Holder; className?: string }) {
  const Icon = HOLDER_ICON[holder.kind];
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <Icon size={13} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">
        {holder.kind === "you" ? "You" : holder.label}
        {holder.kind === "other-team" ? " · outside your team" : ""}
      </span>
      {holder.since === undefined ? null : (
        <span className="proto-num shrink-0 tabular-nums text-[var(--warning-ink)]">
          {elapsed(holder.since)}
        </span>
      )}
    </span>
  );
}

/**
 * The delegation boundary, drawn. Atlas prepares and observes; a named system
 * executes. Used on every surface where work leaves Atlas.
 */
export function Handoff({
  prepares,
  executedBy,
  observes,
  className,
}: {
  prepares: string;
  executedBy: string;
  observes?: ReadonlyArray<string>;
  className?: string;
}) {
  return (
    <Well className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-brand/40 px-1.5 py-0.5 font-semibold text-brand-ink">
          Atlas
        </span>
        <span className="text-muted-foreground">prepares</span>
        <IconArrowNarrowRight size={14} aria-hidden className="text-muted-foreground" />
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-border-strong px-1.5 py-0.5 font-semibold text-foreground">
          {systemLabel(executedBy)}
        </span>
        <span className="text-muted-foreground">executes</span>
        <IconArrowNarrowRight size={14} aria-hidden className="text-muted-foreground" />
        <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-brand/40 px-1.5 py-0.5 font-semibold text-brand-ink">
          Atlas
        </span>
        <span className="text-muted-foreground">observes</span>
      </div>
      <p className="text-[12px] leading-[1.5] text-muted-foreground">{prepares}</p>
      {observes === undefined || observes.length === 0 ? null : (
        <p className="text-[12px] leading-[1.5] text-muted-foreground">
          <span className="text-foreground">Atlas will read back:</span> {observes.join(" · ")}
        </p>
      )}
    </Well>
  );
}

/** Ranked confidence: a strength word, a filled band, then the raw value. */
export function Confidence({
  value,
  label,
  className,
}: {
  value: number;
  label: "high" | "moderate" | "low";
  className?: string;
}) {
  const filled = Math.max(1, Math.round(value * 5));
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground">
        {label}
      </span>
      <span aria-hidden className="flex items-center gap-[3px]">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className={cn(
              "h-2.5 w-1.5 rounded-[1px]",
              index < filled ? "bg-foreground" : "bg-[var(--proto-mark-bg)]",
            )}
          />
        ))}
      </span>
      <span className="proto-num text-[11px] text-muted-foreground">{value.toFixed(2)}</span>
    </span>
  );
}

/** Non-navigating reference to a record in a source system. */
export function SourceRecord({
  systemId,
  externalId,
  onOpen,
}: {
  systemId?: string;
  externalId: string;
  onOpen: (message: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onOpen(`Fixture prototype — this would open ${systemLabel(systemId)} record ${externalId}.`)
      }
      className="inline-flex items-center gap-1 rounded-[3px] text-[12px] font-medium text-brand-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <Id>{externalId}</Id>
      <IconExternalLink size={12} aria-hidden />
      <span className="sr-only">in {systemLabel(systemId)} (fixture)</span>
    </button>
  );
}
