import { IconArrowUp, IconLockBolt } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

const SUGGESTIONS: ReadonlyArray<{ category: string; prompt: string }> = [
  {
    category: "Capability",
    prompt: "Which storage service for a multi-region workload?",
  },
  {
    category: "Landing zone",
    prompt: "Compare DC16 and US-East-1 for a payments service.",
  },
  {
    category: "Onboarding",
    prompt: "How do I provision a sandbox EKS cluster?",
  },
];

export function AskAtlasDeferredHeading() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Ask Atlas
      </span>
      <h2 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
        What can Atlas help you find?
      </h2>
      <p className="text-[12px] leading-5 text-muted-foreground">
        Cited platform answers from authoritative context. Composer ships
        with Phase&nbsp;P5 evidence guarantees.
      </p>
    </div>
  );
}

export function AskAtlasDeferredBody() {
  return (
    <>
      <form
        onSubmit={(event) => event.preventDefault()}
        className={cn(
          "rounded-xl border border-[1.5px] border-border bg-background p-3",
          "transition-[border-color,box-shadow]",
          "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
        )}
      >
        <label className="block">
          <span className="sr-only">Ask Atlas a question</span>
          <textarea
            rows={2}
            disabled
            placeholder="Ask anything about capabilities, landing zones, sources…"
            className={cn(
              "block w-full resize-none bg-transparent text-[13px] leading-[1.6] text-foreground outline-none",
              "placeholder:text-muted-foreground disabled:cursor-not-allowed",
            )}
          />
        </label>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-muted-foreground">
            <IconLockBolt
              aria-hidden
              className="mr-1 inline size-3 align-text-bottom text-muted-foreground"
            />
            Composer disabled
          </p>
          <button
            type="submit"
            disabled
            aria-label="Send question"
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md bg-foreground/10 text-muted-foreground",
              "disabled:cursor-not-allowed",
            )}
          >
            <IconArrowUp className="size-3.5" />
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Try asking
        </p>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
          {SUGGESTIONS.map((item) => (
            <li key={item.prompt}>
              <button
                type="button"
                disabled
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                  "disabled:cursor-not-allowed",
                )}
              >
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {item.category}
                </span>
                <span className="text-[12px] text-foreground">
                  {item.prompt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
