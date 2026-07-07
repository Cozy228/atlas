/**
 * Status board + self-service registration (Step 7, P24 / M3 / M12; ADR-0003).
 * ===========================================================================
 * Hangs off the situation's selected APP (the shared APP / landing-zone
 * selector). AGGREGATION-AT-READ: for the APP's registered locations, the server
 * live-fetches each value through the owning system's adapter and returns it
 * READ-ONLY and UNCITED. There is no store, no history, no alerting (P24).
 *
 * The board's PRIMARY states are the honest ones — a labeled pointer (no adapter
 * / `none` authMode / fetch failure), a loading skeleton, an empty scope. A
 * fetched value is operational status, NOT Evidence: it lives in a visually
 * distinct "uncited" register (`status-uncited-region`), never dressed up as a
 * cited claim (ADR-0003). Degradation is shown plainly, never with alarm styling
 * (calm under load) and never as a fabricated value.
 *
 * Registration is the store's ONLY writer (M11) and carries NO secret field
 * (locked decision 1) — a system without a value-capable adapter simply renders
 * as a labeled pointer until fetch-access lands (M12).
 */
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";
import type { AppRecord, LocationStatusEntry, OperationalLocationKind } from "@atlas/schema";

import { registerLocation } from "@/api/server/locations";
import { statusBoardQueryOptionsFor } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusRow } from "@/components/status/status-row";
import { cn } from "@/lib/utils";

const LOCATION_KINDS: ReadonlyArray<{ value: OperationalLocationKind; label: string }> = [
  { value: "workspace", label: "Workspace" },
  { value: "pipeline", label: "Pipeline" },
  { value: "logs", label: "Logs" },
  { value: "dashboard", label: "Dashboard" },
  { value: "runbook", label: "Runbook" },
];

export function AppStatusBoard({ app }: { app: AppRecord }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const options = statusBoardQueryOptionsFor(app.id);
  const { data, isLoading, isError, refetch } = useQuery(options);
  const statuses = data?.statuses ?? [];
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-sm border border-border bg-card p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={headingId}
            className="text-[1.375rem] leading-tight font-bold tracking-[-0.02em] text-balance text-foreground"
          >
            Status board
          </h2>
          <p className="max-w-[64ch] type-body leading-[1.55] text-pretty text-muted-foreground">
            Where <span className="font-semibold text-foreground">{app.name}</span>&rsquo;s
            operational things live, with their live state read at request time. Read-only and
            uncited — never stored, no history.
          </p>
        </div>
        {formOpen ? null : (
          <Button type="button" onClick={() => setFormOpen(true)} className="shrink-0">
            <IconPlus aria-hidden />
            Register a location
          </Button>
        )}
      </header>

      {formOpen ? (
        <RegisterLocationForm
          appId={app.id}
          onClose={() => setFormOpen(false)}
          onRegistered={async () => {
            await queryClient.invalidateQueries({ queryKey: options.queryKey });
            setFormOpen(false);
          }}
        />
      ) : null}

      <UncitedRegister
        isLoading={isLoading}
        isError={isError}
        statuses={statuses}
        onRetry={() => void refetch()}
      />
    </section>
  );
}

/**
 * The uncited operational register (ADR-0003) — a DISTINCT visual band from any
 * cited Evidence surface: a dashed enclosure tagged "uncited · operational", so a
 * live value is never mistaken for a sourced claim. Always rendered when the board
 * is shown (even empty), so the separation is a first-class, testable hook.
 */
function UncitedRegister({
  isLoading,
  isError,
  statuses,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  statuses: LocationStatusEntry[];
  onRetry: () => void;
}) {
  return (
    <div
      data-testid="status-uncited-region"
      className="flex flex-col gap-3 rounded-sm border border-dashed border-border-strong bg-muted p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="type-eyebrow font-semibold text-muted-foreground">
          Uncited · operational
        </span>
        <span className="type-detail text-muted-foreground">
          Live values, read at request time — not Evidence.
        </span>
      </div>

      {isLoading ? (
        <ol className="flex flex-col gap-2" aria-busy aria-label="Loading operational status">
          {[0, 1].map((i) => (
            <li key={i}>
              <Skeleton className="h-[52px] w-full rounded-xs" />
            </li>
          ))}
        </ol>
      ) : isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xs border border-border bg-card px-3 py-3">
          <p className="type-body text-foreground">
            The status board could not be read for this scope.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : statuses.length === 0 ? (
        <p className="type-body leading-[1.5] text-muted-foreground">
          No locations registered for this app yet. Register one to see its live status, or a
          labeled pointer when no value-capable adapter exists.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {statuses.map((entry) => (
            <li key={entry.location.id}>
              <StatusRow entry={entry} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The inline registration form (M3, locked decision 1). Accessible labeled fields
 * System / Kind / URL and NO secret/token field — a token in a registration would
 * be a secret store + an SSRF proxy at once (the rejected shape). The `url` is a
 * human link only; value fetching goes through the owning adapter's allowlisted
 * base. Replaces the "Register a location" button while open, so the board keeps a
 * single register affordance at a time.
 */
function RegisterLocationForm({
  appId,
  onClose,
  onRegistered,
}: {
  appId: string;
  onClose: () => void;
  onRegistered: () => Promise<void>;
}) {
  const systemId = useId();
  const kindId = useId();
  const urlId = useId();
  const [system, setSystem] = useState("");
  const [kind, setKind] = useState<OperationalLocationKind>("workspace");
  const [url, setUrl] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      registerLocation({
        data: { appId, request: { system: system.trim(), kind, url: url.trim() } },
      }),
    onSuccess: async (response) => {
      toast.success(`Location registered for ${response.location.system}`, {
        description: "Labeled consumer state — no value or secret is stored.",
      });
      await onRegistered();
    },
    onError: () => toast.error("Could not register the location."),
  });

  const canSubmit = system.trim().length > 0 && url.trim().length > 0 && !mutation.isPending;

  return (
    <form
      aria-label="Register a location"
      className="grid gap-4 rounded-sm border border-border bg-muted p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem_1.4fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={systemId}>System</Label>
          <Input
            id={systemId}
            value={system}
            onChange={(event) => setSystem(event.target.value)}
            placeholder="tfe"
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={kindId}>Kind</Label>
          <select
            id={kindId}
            value={kind}
            onChange={(event) => setKind(event.target.value as OperationalLocationKind)}
            className={cn(
              "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow]",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            )}
          >
            {LOCATION_KINDS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={urlId}>URL</Label>
          <Input
            id={urlId}
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://flightdeck.example.com/app/orion/workspaces/prod"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="max-w-[52ch] type-detail leading-[1.5] text-foreground">
          The URL is a human link. No token or secret field exists: Atlas never stores a credential.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!canSubmit}>
            Add location
          </Button>
        </div>
      </div>
    </form>
  );
}
