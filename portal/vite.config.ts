import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

const portalRoot = fileURLToPath(new URL(".", import.meta.url));
const devApiTarget = "http://127.0.0.1:3001";
const devApiPaths = [
  "/api",
  "/mcp",
  "/.well-known",
  "/resources",
  "/health",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/openapi.json",
];

/**
 * Rolldown manual code splitting. Higher `priority` wins when groups overlap.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
 * @see https://rolldown.rs/reference/outputoptions.codesplitting
 */
const portalCodeSplittingGroups = [
  {
    name: "react-dom",
    test: /node_modules[\\/](?:react|react-dom)[\\/]/,
    priority: 52,
  },
  { name: "motion", test: /node_modules[\\/]motion[\\/]/, priority: 30 },
  // react-table is imported only by the lazy availability matrix, so split it
  // out of the eager `tanstack` group (higher priority wins) to keep it off the
  // cold-load path.
  { name: "react-table", test: /node_modules[\\/]@tanstack[\\/]react-table[\\/]/, priority: 26 },
  { name: "tanstack", test: /node_modules[\\/]@tanstack[\\/]/, priority: 25 },
  { name: "aws-icons", test: /node_modules[\\/]aws-react-icons[\\/]/, priority: 23 },
  {
    name: "azure-icons",
    test: /packages[\\/]azure-react-icons[\\/]src[\\/]icons[\\/]/,
    priority: 22,
  },
  // Consolidates `@tabler/icons-react` shared modules instead of dozens of sub‑KB icon chunks.
  { name: "tabler-icons", test: /node_modules[\\/]@tabler[\\/]icons-react[\\/]/, priority: 21 },
  // These small modules are all required by the home route. Keeping them in one
  // chunk avoids paying a separate request for each after dependency upgrades.
  {
    name: "home-shared",
    test: /portal[\\/]src[\\/](?:api[\\/]queries\.ts|components[\\/](?:client-only\.tsx|home[\\/]recently-viewed\.tsx|landing-zone[\\/]context\.tsx|ui[\\/]skeleton\.tsx)|lib[\\/](?:availability-service|deferred-cache|guidance|utils)\.ts)/,
    priority: 20,
  },
];

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: `${portalRoot}src/routes`,
      generatedRouteTree: `${portalRoot}src/routeTree.gen.ts`,
    }),
    viteReact(),
    // React Compiler — official Babel route for React 19 + Vite 8 Rolldown: keep
    // the Oxc/Rolldown main chain and run the compiler as a standalone
    // `@rolldown/plugin-babel` pass. `reactCompilerPreset()` returns a
    // RolldownBabelPreset the plugin consumes directly (preset + filter +
    // client-only env hook + `react/compiler-runtime` optimizeDeps). React 19
    // needs no `target`. Verify via React DevTools "Memo ✨" badges.
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    proxy: Object.fromEntries(
      devApiPaths.map((path) => [
        path,
        {
          target: devApiTarget,
          bypass: (request: { url?: string }) =>
            request.url?.startsWith("/.well-known/agent-skills/") ? request.url : undefined,
        },
      ]),
    ),
  },
  build: {
    ...(command === "build"
      ? {
          outDir: ".output/public",
          emptyOutDir: true,
          manifest: true,
        }
      : {}),
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: portalCodeSplittingGroups,
        },
      },
    },
  },
}));
