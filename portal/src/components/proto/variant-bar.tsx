/**
 * PROTOTYPE (production candidate) — shared direction switcher for `/proto/*`.
 *
 * Each redesigned proto surface ships several genuinely different directions
 * behind one route (`?variant=`). This bar makes every direction reachable and
 * self-describes the page as a prototype, per the review workflow in
 * `prototype/NOTES.md`. It is review chrome: remove together with the losing
 * variants once a direction is picked.
 */
import { cn } from "@/lib/utils";

export type ProtoVariant<Id extends string = string> = {
  id: Id;
  label: string;
  /** One-line direction summary, shown next to the control on wide screens. */
  summary: string;
};

export function VariantBar<Id extends string>({
  variants,
  active,
  onSelect,
}: {
  variants: ReadonlyArray<ProtoVariant<Id>>;
  active: Id;
  onSelect: (id: Id) => void;
}) {
  const current = variants.find((variant) => variant.id === active);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-border bg-card px-3 py-2">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Prototype · {variants.length} directions
      </span>
      <div role="radiogroup" aria-label="Design direction" className="flex rounded-[5px] bg-muted p-0.5">
        {variants.map((variant) => (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={variant.id === active}
            title={variant.summary}
            onClick={() => onSelect(variant.id)}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variant.id === active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {variant.label}
          </button>
        ))}
      </div>
      {current ? (
        <span className="hidden min-w-0 flex-1 truncate text-right text-xs text-muted-foreground lg:block">
          {current.summary}
        </span>
      ) : null}
    </div>
  );
}
