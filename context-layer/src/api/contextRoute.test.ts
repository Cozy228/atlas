import { describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, ContextBundleResponseSchema } from "@atlas/schema";
import { handleContextRequest } from "./contextRoute.js";

describe("context route", () => {
  it("returns a context bundle response for valid input", () => {
    const response = handleContextRequest({ topic_id: "aws-textract" });

    expect(response.status).toBe(200);
    expect(ContextBundleResponseSchema.parse(response.body)).toEqual(response.body);
  });

  it("returns structured topic_not_found errors", () => {
    const response = handleContextRequest({ topic_id: "unknown-topic" });

    expect(response.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: "topic_not_found",
        message: "Topic was not found in the Atlas registry.",
      },
    });
  });

  it("returns structured source_not_found errors", () => {
    const response = handleContextRequest({ source_id: "missing-source" });

    expect(response.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
      "source_not_found",
    );
  });

  it("returns structured anchor_broken errors for explicit bad anchor expansion", () => {
    const response = handleContextRequest({
      source_id: "textract-module-readme",
      anchor_id: "missing-anchor",
    });

    expect(response.status).toBe(422);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
      "anchor_broken",
    );
  });

  it("returns structured access_denied errors for restricted source expansion", () => {
    const response = handleContextRequest({ source_id: "iam-boundary-policy" });

    expect(response.status).toBe(403);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
      "access_denied",
    );
  });

  it("returns structured source_unavailable errors for unavailable explicit expansion", () => {
    const response = handleContextRequest({ source_id: "platform-reference-guide" });

    expect(response.status).toBe(503);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
      "source_unavailable",
    );
  });

  it("returns structured invalid_request errors", () => {
    const response = handleContextRequest({ disclosure_level: 9 });

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe(
      "invalid_request",
    );
  });
});
