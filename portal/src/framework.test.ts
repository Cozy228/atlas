import { describe, expect, it } from "vitest";
import { portalFramework } from "./framework";

describe("Portal framework", () => {
  it("declares TanStack Start and Vite as the Portal runtime", () => {
    expect(portalFramework).toEqual({
      app: "TanStack Start",
      router: "TanStack Router",
      bundler: "Vite",
    });
  });
});
