import { lazy, Suspense, useState } from "react";
import { IconMessage2 } from "@tabler/icons-react";

import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const AskAtlasChat = lazy(() =>
  import("@/components/ask/ask-atlas-chat").then((mod) => ({
    default: mod.AskAtlasChat,
  })),
);

export function AskAtlasFab() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Ask Atlas"
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
        >
          <IconMessage2 className="size-6" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex h-[min(680px,calc(100vh-3rem))] w-full max-w-2xl flex-col gap-4 p-6"
      >
        <DialogHeader className="flex flex-col gap-1.5 space-y-0">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Ask Atlas
          </span>
          <DialogTitle className="text-[18px] font-bold tracking-[-0.02em]">
            What can Atlas help you find?
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-5">
            Cited platform answers from registered authoritative context.
          </DialogDescription>
        </DialogHeader>
        <ClientOnly fallback={<Skeleton className="h-full w-full rounded-lg" />}>
          <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
            <AskAtlasChat />
          </Suspense>
        </ClientOnly>
      </DialogContent>
    </Dialog>
  );
}
