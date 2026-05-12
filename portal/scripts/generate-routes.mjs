// Generates `src/routeTree.gen.ts` using the official @tanstack/router-generator.
//
// We run this before `tsc --noEmit` so the typed router fully drives Link
// type inference. The Vite plugin regenerates the same file at dev/build,
// so committing the generated tree is fine.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, "..");

const config = getConfig({
  target: "react",
  routesDirectory: path.join(portalRoot, "src/routes"),
  generatedRouteTree: path.join(portalRoot, "src/routeTree.gen.ts"),
  autoCodeSplitting: false,
  enableRouteTreeFormatting: false,
});

const generator = new Generator({ config, root: portalRoot });
await generator.run();

console.log("Generated", path.relative(portalRoot, config.generatedRouteTree));
