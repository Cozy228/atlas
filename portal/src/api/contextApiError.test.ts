import { describe, expect, it } from "vitest";

import {
  ContextApiError,
  mapErrorCodeToUiState,
} from "./contextApiError.js";

describe("ContextApiError", () => {
  it("constructs from a structured ApiErrorResponse body", () => {
    const error = ContextApiError.fromResponse({
      status: 404,
      body: {
        error: {
          code: "topic_not_found",
          message: "Topic was not found in the Atlas registry.",
        },
      },
    });

    expect(error).toBeInstanceOf(ContextApiError);
    expect(error.code).toBe("topic_not_found");
    expect(error.status).toBe(404);
    expect(error.message).toBe(
      "Topic was not found in the Atlas registry.",
    );
  });
});

describe("mapErrorCodeToUiState", () => {
  it("maps every API error code to a deterministic UI state", () => {
    expect(mapErrorCodeToUiState("topic_not_found")).toBe("not_found");
    expect(mapErrorCodeToUiState("source_not_found")).toBe("not_found");
    expect(mapErrorCodeToUiState("anchor_broken")).toBe("broken");
    expect(mapErrorCodeToUiState("source_unavailable")).toBe("unavailable");
    expect(mapErrorCodeToUiState("access_denied")).toBe("restricted");
    expect(mapErrorCodeToUiState("invalid_request")).toBe("invalid");
  });
});
