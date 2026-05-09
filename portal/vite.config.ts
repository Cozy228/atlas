import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const portalRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    // TanStack Start owns route generation and route code splitting.
    tanstackStart({
      router: {
        routesDirectory: `${portalRoot}src/routes`,
        generatedRouteTree: `${portalRoot}src/routeTree.gen.ts`,
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
});
