import { describe, expect, it } from "vitest";

import { bridgeContextApiRequest } from "./contextApiBridge";

describe("Portal Context API bridge", () => {
  it("propagates an aborted browser request to the Context API handler", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("Client disconnected", "AbortError"));

    await expect(
      bridgeContextApiRequest(
        new Request("https://portal.example.com/api/resources/catalog", {
          signal: controller.signal,
        }),
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
