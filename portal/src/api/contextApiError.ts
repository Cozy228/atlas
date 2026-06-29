import type { ApiErrorCode, ApiErrorResponse } from "@atlas/schema";

export type ContextApiErrorCode = ApiErrorCode;

/**
 * Error thrown by the Portal Context API client when the underlying handler
 * returned a structured ApiErrorResponse. Loaders catch this to map error
 * codes onto deterministic UI states (no rendering of raw exceptions).
 */
export class ContextApiError extends Error {
  readonly code: ContextApiErrorCode;
  readonly status: number;

  constructor(input: { code: ContextApiErrorCode; message: string; status: number }) {
    super(input.message);
    this.name = "ContextApiError";
    this.code = input.code;
    this.status = input.status;
  }

  static fromResponse(input: { status: number; body: ApiErrorResponse }): ContextApiError {
    return new ContextApiError({
      code: input.body.error.code,
      message: input.body.error.message,
      status: input.status,
    });
  }
}

export type ContextApiUiState =
  | "not_found"
  | "broken"
  | "unavailable"
  | "restricted"
  | "invalid"
  | "unknown";

/**
 * Map a structured ApiErrorCode to the UI state vocabulary used by route
 * components. Centralised so every surface stays consistent with the design
 * plan's evidence-first contract.
 */
export function mapErrorCodeToUiState(code: ContextApiErrorCode): ContextApiUiState {
  switch (code) {
    case "resource_not_found":
    case "source_not_found":
      return "not_found";
    case "anchor_broken":
      return "broken";
    case "source_unavailable":
      return "unavailable";
    case "access_denied":
      return "restricted";
    case "invalid_request":
      return "invalid";
    default:
      return "unknown";
  }
}
