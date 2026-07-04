import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppRecord, LandingZone } from "@atlas/schema";

import { registerApp } from "@/api/server/apps";
import { appsQueryOptions } from "@/api/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AppDeclareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zones: ReadonlyArray<LandingZone>;
  /** Called with the freshly registered record so the caller can select it. */
  onDeclared: (app: AppRecord) => void;
};

/**
 * The self-declare form (Step 3, P21 fallback for non-repo situations). Drives
 * `POST /api/apps` through the governed client; `origin` is server-set
 * (`self-declared`), never chosen here. Dangling declarations come back as
 * `warnings[]` (the record is kept verbatim) and are surfaced, not blocking.
 */
export function AppDeclareDialog({ open, onOpenChange, zones, onDeclared }: AppDeclareDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [services, setServices] = useState("");

  function reset() {
    setName("");
    setZoneIds([]);
    setServices("");
  }

  const mutation = useMutation({
    mutationFn: async () =>
      registerApp({
        data: {
          name: name.trim(),
          landingZoneIds: zoneIds,
          serviceSlugs: services
            .split(",")
            .map((slug) => slug.trim())
            .filter((slug) => slug.length > 0),
        },
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: appsQueryOptions.queryKey });
      toast.success(`App “${response.app.name}” declared`, {
        description:
          response.warnings.length > 0
            ? `${response.warnings.length} declaration warning(s) — kept as declared.`
            : "Labeled self-declared.",
      });
      onDeclared(response.app);
      onOpenChange(false);
      reset();
    },
    onError: () => toast.error("Could not declare the app."),
  });

  const canSubmit = name.trim().length > 0 && zoneIds.length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Declare an app</DialogTitle>
          <DialogDescription>
            Self-declared and always labeled — for situations without a repo manifest.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              mutation.mutate();
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="app-name">App name</Label>
            <Input
              id="app-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Orion Checkout"
              autoComplete="off"
            />
          </div>

          <div role="group" aria-label="Landing zones" className="space-y-1.5">
            <span className="type-eyebrow text-muted-foreground">Landing zones</span>
            <div className="space-y-1">
              {zones.map((zone) => (
                <label key={zone.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    value={zone.id}
                    checked={zoneIds.includes(zone.id)}
                    onChange={(event) =>
                      setZoneIds((prev) =>
                        event.target.checked
                          ? [...prev, zone.id]
                          : prev.filter((id) => id !== zone.id),
                      )
                    }
                  />
                  {zone.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="app-services">Services (optional)</Label>
            <Input
              id="app-services"
              value={services}
              onChange={(event) => setServices(event.target.value)}
              placeholder="aws/textract, aws/s3"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!canSubmit}>
              Declare
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
