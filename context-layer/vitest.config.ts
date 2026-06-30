import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node-mode MSW lifecycle for integration tests. Unit tests inject their own
    // FetchLike fake and are unaffected (the server bypasses un-mocked requests).
    setupFiles: ["./src/devMocks/setup.ts"],
  },
});
