import { useState } from "react";
import { IconMessage2 } from "@tabler/icons-react";

import {
  AskAtlasDeferredBody,
  AskAtlasDeferredHeading,
} from "@/components/ask-atlas-deferred-content";
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

export function AskAtlasFab() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Ask Atlas (deferred)"
          className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
        >
          <IconMessage2 className="size-6" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(640px,calc(100vh-3rem))] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6"
      >
        <DialogHeader>
          <DialogTitle asChild>
            <AskAtlasDeferredHeading />
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ask Atlas composer (deferred until Phase P5).
          </DialogDescription>
        </DialogHeader>
        <ClientOnly>
          <AskAtlasDeferredBody />
        </ClientOnly>
      </DialogContent>
    </Dialog>
  );
}
