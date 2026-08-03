import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dockerfile = await readFile(fileURLToPath(new URL("../Dockerfile", import.meta.url)), "utf8");

describe("production container contract", () => {
  it("copies the prebuilt artifact for the non-root runtime user", () => {
    expect(dockerfile).toContain("COPY --link --chown=node:node .output ./.output");
    expect(dockerfile).toContain("USER node");
  });

  it("keeps an application-level health check", () => {
    expect(dockerfile).toContain("HEALTHCHECK --interval=30s");
    expect(dockerfile).toContain("fetch('http://127.0.0.1:' + process.env.PORT + '/health')");
  });
});
