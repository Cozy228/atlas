import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/lambda/handler.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist/lambda",
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: () => true,
    onlyBundle: false,
  },
  outputOptions: {
    codeSplitting: false,
  },
});
