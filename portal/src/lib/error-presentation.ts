/**
 * One place that turns a thrown error into the vocabulary the UI renders — used
 * by both the in-place deferred-region error and the full-page route error, so a
 * 403 reads the same wherever it surfaces.
 *
 * Status taxonomy mirrors the Context API (`contextRoute.ts`):
 *   404 not_found · 403 access_denied (restricted) · 422 anchor_broken ·
 *   400 invalid_request · 503 source_unavailable (live fetch / resolve / parse).
 * Only 5xx / network (no status) are retryable — a 403/404/422 won't change on a
 * retry, so those never offer one.
 */
import { ContextApiError } from "@/api/contextApiError";

export type ErrorPresentation = {
  status?: number;
  title: string;
  detail: string;
  /** 5xx or a network failure (no status) — a retry might succeed. */
  retryable: boolean;
  /** 403 — surfaced with a lock affordance, never a retry. */
  restricted: boolean;
};

export function presentError(error: unknown, subject = "this content"): ErrorPresentation {
  const status = error instanceof ContextApiError ? error.status : undefined;

  switch (status) {
    case 403:
      return {
        status,
        title: "Access restricted",
        detail: `${subject} is registered, but access is restricted.`,
        retryable: false,
        restricted: true,
      };
    case 404:
      return {
        status,
        title: "Not found",
        detail: `${subject} is not in the Atlas registry.`,
        retryable: false,
        restricted: false,
      };
    case 422:
      return {
        status,
        title: "Reference unresolved",
        detail: `A cited reference in ${subject} could not be resolved.`,
        retryable: false,
        restricted: false,
      };
    case 400:
      return {
        status,
        title: "Invalid request",
        detail: `The request for ${subject} was rejected.`,
        retryable: false,
        restricted: false,
      };
    default:
      // 503, any other 5xx, or a network failure with no status — transient.
      return {
        status,
        title: status && status >= 500 ? "Temporarily unavailable" : "Couldn’t load",
        detail: `The live request for ${subject} failed${status ? ` (${status})` : ""}.`,
        retryable: true,
        restricted: false,
      };
  }
}
