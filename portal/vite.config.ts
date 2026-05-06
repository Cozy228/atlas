import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
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
    // tanstackRouter must run before tanstackStart and viteReact so that the
    // generated routeTree.gen.ts is available to the React compiler.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: `${portalRoot}src/routes`,
      generatedRouteTree: `${portalRoot}src/routeTree.gen.ts`,
    }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
});
