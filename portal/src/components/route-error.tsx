/**
 * Full-page route error — the router's `defaultErrorComponent`.
 * ============================================================
 * When a loader throws (the awaited PRIMARY data failed), the page can't render,
 * so we show a real, status-aware error page in the portal shell — the sibling of
 * the 404 `notFoundComponent`, not TanStack's bare default. Status drives the
 * copy and the actions: a 503 / network error offers Retry (re-run the loader); a
 * 403 / 404 is terminal and only offers a way back.
 *
 * Deferred SECONDARY data failures don't reach here — those stay in place via
 * `DeferredRegion`. This page is for "the shell itself couldn't load".
 */
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { IconRefresh } from "@tabler/icons-react";

import { presentError } from "@/lib/error-presentation";
import { cn } from "@/lib/utils";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  const presentation = presentError(error, "This page");
  const [retrying, setRetrying] = useState(false);

  const eyebrow = presentation.status
    ? `${presentation.status} · ${presentation.title.toLowerCase()}`
    : "error";

  const handleRetry = () => {
    setRetrying(true);
    void Promise.resolve(router.invalidate()).finally(() => setRetrying(false));
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-6 py-16">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {eyebrow}
      </span>
      <h1 className="type-heading font-semibold tracking-[-0.03em] text-foreground">
        {presentation.restricted
          ? "Atlas can’t show you that record."
          : presentation.retryable
            ? "Atlas couldn’t reach that data."
            : "Atlas hit an error loading that page."}
      </h1>
      <p className="text-sm leading-[1.6] text-muted-foreground">
        {presentation.detail}{" "}
        {presentation.retryable
          ? "This is usually temporary — retry, or come back shortly."
          : presentation.restricted
            ? "Contact the steward listed on the record for access."
            : "Browse the catalog, guidance, or sources to find what you need."}
      </p>
      <div className="flex flex-wrap gap-2">
        {presentation.retryable ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors",
              "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <IconRefresh aria-hidden className={cn("size-3.5", retrying && "animate-spin")} />
            {retrying ? "Retrying…" : "Retry"}
          </button>
        ) : null}
        <Link
          to="/"
          className={cn(
            "inline-flex items-center rounded-md px-3 py-2 text-xs font-semibold transition-colors",
            presentation.retryable
              ? "border border-border bg-card text-foreground hover:bg-muted"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          Back to home
        </Link>
        <Link
          to="/catalog"
          className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
        >
          Browse catalog
        </Link>
      </div>
    </div>
  );
}
