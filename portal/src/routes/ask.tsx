import { createFileRoute } from "@tanstack/react-router";

import { AskAtlasChat } from "@/components/ask/ask-atlas-chat";
import { ClientOnly } from "@/components/client-only";
import { PageBody } from "@/components/page-section";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/ask")({
  component: AskAtlasRoute,
});

function AskAtlasRoute() {
  return (
    <PageBody width="comfortable" gap="compact">
      <Hero />
      <div className="mx-auto w-full max-w-[760px]">
        <ClientOnly fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
          <AskAtlasChat className="min-h-[560px] overflow-hidden rounded-xl border border-border bg-card" />
        </ClientOnly>
      </div>
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
        Cited platform answers from authoritative context. Every claim links back to its registered
        source.
      </p>
    </div>
  );
}

function Boundary() {
  return (
    <section className="mx-auto w-full max-w-[760px] rounded-xl border border-border bg-card p-4">
      <p className="text-[12px] font-bold text-foreground">How Ask Atlas behaves</p>
      <ul className="mt-2 grid gap-1.5 text-[12px] leading-[1.6] text-muted-foreground sm:grid-cols-2">
        <BoundaryLine
          label="Question scope"
          copy="Cited platform context only. No web retrieval."
        />
        <BoundaryLine label="Evidence first" copy="Claims without a citation are blocked." />
        <BoundaryLine
          label="Server-side"
          copy="Prompt construction and rate limits run server-side."
        />
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
