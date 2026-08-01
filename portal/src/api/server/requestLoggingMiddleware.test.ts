import { describe, expect, it } from "vitest";

import requestLogging from "../../../server/middleware/request-logging";

describe("request logging middleware", () => {
  it("preserves a safe inbound request id on the response", async () => {
    const request = new Request("https://portal.example.com/capabilities", {
      headers: { "x-request-id": "req-123" },
    });

    const response = (await requestLogging(request, () => new Response("ok"))) as Response;

    expect(await response.text()).toBe("ok");
    expect(response.headers.get("x-request-id")).toBe("req-123");
  });

  it("does not swallow handler failures", async () => {
    const failure = new Error("handler failed");
    await expect(
      requestLogging(new Request("https://portal.example.com/capabilities"), () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
