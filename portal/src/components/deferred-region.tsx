/**
 * Deferred region + in-place error handling.
 * ==========================================
 * Routes defer their slow/live data (availability, context bundles, feeds) and
 * render a skeleton via `<Await>` until it lands. When that deferred promise
 * REJECTS, a bare `<Await>` re-throws to the nearest route boundary — with no
 * per-route `errorComponent` that's the router's full-page default, which blows
 * the whole page away over one failed section.
 *
 * `DeferredRegion` wraps the `<Await>` in TanStack's `CatchBoundary` so the
 * failure is shown IN PLACE — exactly where the skeleton was — leaving the rest
 * of the page intact. The error copy is status-aware (`presentError`): a 503 /
 * network failure offers a Retry; a 403 / 404 / 422 does not (a retry can't fix
 * it). Retry re-runs the route loader (`router.invalidate()`, which refetches the
 * errored query — errored queries hold no cached data) and then resets the
 * boundary so the `<Await>` re-attempts with the fresh promise.
 *
 * Only deferred SECONDARY data belongs here. Errors thrown from the loader itself
 * (the awaited primary data) bubble to the route's full-page error (see
 * `route-error.tsx`) — that's the "every error gets a real page" half.
 *
 * Retry placement: pass `retry` on the ONE primary region per loader promise. A
 * single `router.invalidate()` refetches the whole page, so the primary's button
 * is enough; sibling regions sharing that promise show the error without a button.
 */
import { useState, type ReactNode } from "react";
import { Await, CatchBoundary, useRouter } from "@tanstack/react-router";
import { IconAlertTriangle, IconLock, IconRefresh } from "@tabler/icons-react";

import { presentError } from "@/lib/error-presentation";
import { cn } from "@/lib/utils";

export function DeferredRegion<T>({
  promise,
  fallback,
  children,
  label = "this section",
  className,
  retry = false,
  errorFallback,
}: {
  promise: Promise<T>;
  fallback: ReactNode;
  children: (value: T) => ReactNode;
  /** Noun phrase woven into the error copy, e.g. "the policy documents". */
  label?: string;
  /** Extra classes on the in-place error card (e.g. to match the region width). */
  className?: string;
  /**
   * Show a Retry on this region when the failure is retryable (503 / network).
   * Set on the primary region for each deferred promise; one invalidate refetches
   * the page, so sibling regions on the same promise stay button-less.
   */
  retry?: boolean;
  /**
   * For small ENHANCEMENT regions (an icon, an inline count) where a full error
   * card is heavier than the content. On rejection, render this instead of the
   * card — a silent graceful degrade. Pass `null` to render nothing. Omit it for
   * CONTENT regions that should show the card.
   */
  errorFallback?: ReactNode;
}) {
  const router = useRouter();
  return (
    <CatchBoundary
      // Reset on navigation so a stale error never sticks across a param change;
      // retry resets explicitly via the `reset` arg below.
      getResetKey={() => router.state.location.pathname}
      errorComponent={({ error, reset }) =>
        errorFallback !== undefined ? (
          <>{errorFallback}</>
        ) : (
          <DeferredError
            error={error}
            label={label}
            className={className}
            onRetry={
              retry ? () => Promise.resolve(router.invalidate()).then(() => reset()) : undefined
            }
          />
        )
      }
    >
      <Await promise={promise} fallback={fallback}>
        {children}
      </Await>
    </CatchBoundary>
  );
}

function DeferredError({
  error,
  label,
  className,
  onRetry,
}: {
  error: unknown;
  label: string;
  className?: string;
  onRetry?: () => Promise<void>;
}) {
  const presentation = presentError(error, label);
  const [retrying, setRetrying] = useState(false);
  const canRetry = Boolean(onRetry) && presentation.retryable;

  const handleRetry = () => {
    setRetrying(true);
    // The reset (inside onRetry) unmounts this card on success, so there's no
    // need to clear `retrying`; a repeat failure remounts a fresh card.
    void onRetry?.().catch(() => setRetrying(false));
  };

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-[13px]",
        presentation.restricted
          ? "border-warning/30 bg-warning/5"
          : "border-critical/30 bg-critical/5",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        {presentation.restricted ? (
          <IconLock aria-hidden className="size-4 text-warning" />
        ) : (
          <IconAlertTriangle aria-hidden className="size-4 text-critical" />
        )}
        {presentation.title}
      </p>
      <p className="leading-[1.5] text-muted-foreground">
        {presentation.detail}{" "}
        {canRetry
          ? "Retry, or check back shortly."
          : presentation.restricted
            ? "Contact the steward for access."
            : "The rest of the page is unaffected."}
      </p>
      {canRetry ? (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className={cn(
            "mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors",
            "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <IconRefresh aria-hidden className={cn("size-3.5", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      ) : null}
    </div>
  );
}
