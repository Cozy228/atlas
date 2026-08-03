import { describe, expect, it } from "vitest";
import { portalFramework } from "./framework";

describe("Portal framework", () => {
  it("declares TanStack Router SPA and Vite as the Portal runtime", () => {
    expect(portalFramework).toEqual({
      app: "TanStack Router SPA",
      router: "TanStack Router",
      bundler: "Vite",
    });
  });
});
