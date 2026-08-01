import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPortalResourceCatalog, submitPortalFeedback } from "./portalContextApiClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Portal Context API client", () => {
  it("starts a cancellable same-origin catalog request", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { resources: [] }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    await expect(fetchPortalResourceCatalog({ signal: controller.signal })).resolves.toEqual({
      resources: [],
    });
    expect(fetch).toHaveBeenCalledWith("/api/resources/catalog", {
      method: "GET",
      signal: controller.signal,
    });
  });

  it("rejects a pending catalog request when navigation aborts it", async () => {
    const fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();

    const request = fetchPortalResourceCatalog({ signal: controller.signal });
    controller.abort(new DOMException("Navigation superseded", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("posts feedback without a Start server-function transport", async () => {
    const feedback = {
      id: "feedback-1",
      target_type: "resource" as const,
      target_id: "service/aws/textract",
      feedback_type: "missing" as const,
      message: "Add region guidance.",
      submitted_at: "2026-05-11T00:00:00.000Z",
    };
    const fetch = vi.fn(async () => jsonResponse(201, { feedback }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      submitPortalFeedback({
        target_type: feedback.target_type,
        target_id: feedback.target_id,
        feedback_type: feedback.feedback_type,
        message: feedback.message,
      }),
    ).resolves.toEqual({ feedback });
    expect(fetch).toHaveBeenCalledWith(
      "/api/feedback",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
