import { createFileRoute } from "@tanstack/react-router";
import { IconArrowUp, IconLockBolt } from "@tabler/icons-react";

import { PageBody } from "@/components/page-section";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ask")({
  component: AskAtlasRoute,
});

const SUGGESTIONS: ReadonlyArray<{ category: string; prompt: string }> = [
  {
    category: "Capability",
    prompt: "Which storage service should I use for a multi-region workload?",
  },
  {
    category: "Landing zone",
    prompt: "Compare DC16 and US-East-1 for a regulated payments service.",
  },
  {
    category: "Onboarding",
    prompt: "How do I provision a sandbox EKS cluster from Harness?",
  },
  {
    category: "Guardrails",
    prompt: "What policies apply to data exports out of the GDC region?",
  },
];

function AskAtlasRoute() {
  return (
    <PageBody width="comfortable" gap="compact">
      <Hero />
      <Composer />
      <Suggestions />
      <Boundary />
    </PageBody>
  );
}

function Hero() {
  return (
    <div className="flex flex-col items-center gap-3 pt-8 text-center">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Ask Atlas
      </span>
      <h1 className="max-w-[20ch] text-[36px] font-bold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[40px]">
        What can Atlas help you find?
      </h1>
      <p className="max-w-[56ch] text-[15px] leading-[1.6] text-muted-foreground">
        Cited platform answers from authoritative context. Every claim links
        back to its source.
      </p>
    </div>
  );
}

function Composer() {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className={cn(
        "mx-auto w-full max-w-[760px] rounded-2xl border border-[1.5px] border-border bg-card p-3.5",
        "shadow-sm transition-[border-color,box-shadow]",
        "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
      )}
    >
      <label className="block">
        <span className="sr-only">Ask Atlas a question</span>
        <textarea
          name="question"
          rows={3}
          disabled
          placeholder="Ask anything about capabilities, landing zones, guardrails, sources…"
          className={cn(
            "block w-full resize-none bg-transparent text-[15px] leading-[1.6] text-foreground outline-none",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed",
          )}
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          <IconLockBolt
            aria-hidden
            className="mr-1 inline size-3 align-text-bottom text-muted-foreground"
          />
          Composer disabled · ships with Phase&nbsp;P5 evidence guarantees
        </p>
        <button
          type="submit"
          disabled
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg bg-foreground/10 text-muted-foreground",
            "disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="Send question"
        >
          <IconArrowUp className="size-4" />
        </button>
      </div>
    </form>
  );
}

function Suggestions() {
  return (
    <section className="mx-auto flex w-full max-w-[760px] flex-col gap-2">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        Try asking
      </p>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {SUGGESTIONS.map((item) => (
          <li key={item.prompt}>
            <button
              type="button"
              disabled
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                "hover:bg-muted/40 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {item.category}
              </span>
              <span className="text-[13px] text-foreground">{item.prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Boundary() {
  return (
    <section className="mx-auto w-full max-w-[760px] rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] font-bold text-foreground">
        How Ask Atlas behaves
      </p>
      <ul className="mt-2 grid gap-1.5 text-[12px] leading-[1.6] text-muted-foreground sm:grid-cols-2">
        <BoundaryLine label="Question scope" copy="Cited platform context only. No web retrieval." />
        <BoundaryLine label="Evidence first" copy="Claims without a citation are blocked." />
        <BoundaryLine label="Server-side" copy="Prompt construction and rate limits run server-side." />
        <BoundaryLine label="Surface" copy="Each claim maps to a citation chip in the answer." />
      </ul>
    </section>
  );
}

function BoundaryLine({ label, copy }: { label: string; copy: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-foreground">
        {label}
      </span>
      <span>{copy}</span>
    </li>
  );
}
