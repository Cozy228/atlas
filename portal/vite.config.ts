// @ts-nocheck
// TanStack Start `tanstackStart()` plus Vite 8 Rolldown `UserConfig` nesting can exceed TypeScript's inference stack
// in strict IDE checks. Runtime matches TanStack docs; `pnpm run lint` still typechecks app sources.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

const portalRoot = fileURLToPath(new URL(".", import.meta.url));
const isVitest = process.env.VITEST === "true";

/**
 * Rolldown manual code splitting. Higher `priority` wins when groups overlap.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
 * @see https://rolldown.rs/reference/outputoptions.codesplitting
 */
const portalCodeSplittingGroups = [
  { name: "react-dom", test: /node_modules[\\/]react-dom[\\/]/, priority: 52 },
  { name: "react", test: /node_modules[\\/]react[\\/]/, priority: 50 },
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
];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tanstackStart({
      router: {
        routesDirectory: `${portalRoot}src/routes`,
        generatedRouteTree: `${portalRoot}src/routeTree.gen.ts`,
      },
    }),
    // `serverDir` enables Nitro filesystem routing for the agent-facing
    // server surface (`server/routes/**`, `server/middleware/**`) without
    // touching the TanStack route tree.
    !isVitest &&
      nitro({
        serverDir: "server",
        // Pre-compress public assets (>1KB) to .gz/.br at build time so any host
        // serves smaller bytes with zero runtime overhead. CDNs that already
        // compress will simply ignore these files.
        compressPublicAssets: { gzip: true, brotli: true },
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
  build: {
    // ponytail: chunkImportMap (Vite 8.1) left off — it breaks the Nitro server
    // re-bundle pass (UNRESOLVED_IMPORT on importmap-driven SSR chunks).
    // Re-enable if/when nitro/vite resolves importmap chunks.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: portalCodeSplittingGroups,
        },
      },
    },
  },
});
